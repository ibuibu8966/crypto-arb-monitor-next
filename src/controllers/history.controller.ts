import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHistoryUseCase, getHistoryFromCacheUseCase } from "@/use-cases/get-history.use-case";
import { getCachedHistory, setCacheHistory } from "@/lib/stats-cache";
import { captureError } from "@/lib/logger";

const querySchema = z.object({
  symbol: z.string().min(1),
  hours: z.coerce.number().min(1).max(8760).default(24),
});

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" };

/** 同時DBクエリ数を制限するセマフォ（spread_log直接クエリ用） */
const MAX_CONCURRENT = 3;
let running = 0;
const queue: Array<{ resolve: () => void }> = [];

async function acquireSemaphore(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++;
    return;
  }
  return new Promise<void>((resolve) => {
    queue.push({ resolve });
  });
}

function releaseSemaphore(): void {
  const next = queue.shift();
  if (next) {
    next.resolve();
  } else {
    running--;
  }
}

export async function getHistoryController(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { symbol, hours } = querySchema.parse(params);

    // 1. メモリキャッシュチェック（DBアクセス不要）
    const cached = getCachedHistory(symbol, hours);
    if (cached) {
      return NextResponse.json(cached, { headers: CACHE_HEADERS });
    }

    // 2. 24hリクエスト → キャッシュテーブルから取得（軽量、セマフォ不要）
    if (hours === 24) {
      const cacheData = await getHistoryFromCacheUseCase(symbol);
      if (cacheData) {
        setCacheHistory(symbol, hours, cacheData);
        return NextResponse.json(cacheData, { headers: CACHE_HEADERS });
      }
      // キャッシュテーブルが空ならフォールバック（下のセマフォ付きクエリへ）
    }

    // 3. 重いクエリ → セマフォでDB同時アクセスを制限
    await acquireSemaphore();
    try {
      const cachedAfterWait = getCachedHistory(symbol, hours);
      if (cachedAfterWait) {
        return NextResponse.json(cachedAfterWait, { headers: CACHE_HEADERS });
      }

      const data = await getHistoryUseCase(symbol, hours);
      setCacheHistory(symbol, hours, data);

      return NextResponse.json(data, { headers: CACHE_HEADERS });
    } finally {
      releaseSemaphore();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    captureError("history", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
