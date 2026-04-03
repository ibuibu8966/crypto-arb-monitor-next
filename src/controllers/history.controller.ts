import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHistoryUseCase } from "@/use-cases/get-history.use-case";
import { getCachedHistory, setCacheHistory } from "@/lib/stats-cache";
import { captureError } from "@/lib/logger";

const querySchema = z.object({
  symbol: z.string().min(1),
  hours: z.coerce.number().min(1).max(8760).default(24),
});

/** 同時DBクエリ数を制限するセマフォ */
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

    // メモリキャッシュチェック（DBアクセス不要）
    const cached = getCachedHistory(symbol, hours);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
      });
    }

    // セマフォでDB同時アクセスを制限
    await acquireSemaphore();
    try {
      // セマフォ取得後に再度キャッシュチェック（待っている間に別リクエストがキャッシュした可能性）
      const cachedAfterWait = getCachedHistory(symbol, hours);
      if (cachedAfterWait) {
        return NextResponse.json(cachedAfterWait, {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
        });
      }

      const data = await getHistoryUseCase(symbol, hours);
      setCacheHistory(symbol, hours, data);

      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
      });
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
