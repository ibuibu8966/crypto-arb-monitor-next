import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHistoryUseCase, getHistoryFromCacheUseCase } from "@/use-cases/get-history.use-case";
import { getArchiveHistoryUseCase } from "@/use-cases/get-archive-history.use-case";
import { getCachedHistory, setCacheHistory } from "@/lib/stats-cache";
import { isR2ReadEnabled } from "@/lib/r2-client";
import { captureError } from "@/lib/logger";

const querySchema = z.object({
  symbol: z.string().min(1),
  hours: z.coerce.number().min(1).max(8760).default(24),
  source: z.enum(["live", "archive"]).default("live"),
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

/** R2アーカイブ読み出し用の独立セマフォ（live系と干渉させない） */
const ARCHIVE_MAX_CONCURRENT = 2;
let archiveRunning = 0;
const archiveQueue: Array<{ resolve: () => void }> = [];

async function acquireArchiveSemaphore(): Promise<void> {
  if (archiveRunning < ARCHIVE_MAX_CONCURRENT) {
    archiveRunning++;
    return;
  }
  return new Promise<void>((resolve) => {
    archiveQueue.push({ resolve });
  });
}

function releaseArchiveSemaphore(): void {
  const next = archiveQueue.shift();
  if (next) {
    next.resolve();
  } else {
    archiveRunning--;
  }
}

export async function getHistoryController(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { symbol, hours, source } = querySchema.parse(params);

    // archive 経路 — R2 上の Parquet から取得
    if (source === "archive") {
      if (!isR2ReadEnabled()) {
        return NextResponse.json(
          { error: "R2 archive read is disabled" },
          { status: 503 }
        );
      }
      const archiveCacheKey = -hours; // live と衝突しないようマイナス側を使う
      const cachedArchive = getCachedHistory(symbol, archiveCacheKey);
      if (cachedArchive) {
        return NextResponse.json(cachedArchive, { headers: CACHE_HEADERS });
      }
      await acquireArchiveSemaphore();
      try {
        const cachedAfter = getCachedHistory(symbol, archiveCacheKey);
        if (cachedAfter) {
          return NextResponse.json(cachedAfter, { headers: CACHE_HEADERS });
        }
        const data = await getArchiveHistoryUseCase(symbol, hours);
        setCacheHistory(symbol, archiveCacheKey, data);
        return NextResponse.json(data, { headers: CACHE_HEADERS });
      } finally {
        releaseArchiveSemaphore();
      }
    }

    // live 経路（既存ロジック）
    const cached = getCachedHistory(symbol, hours);
    if (cached) {
      return NextResponse.json(cached, { headers: CACHE_HEADERS });
    }

    if (hours === 24) {
      const cacheData = await getHistoryFromCacheUseCase(symbol);
      if (cacheData) {
        setCacheHistory(symbol, hours, cacheData);
        return NextResponse.json(cacheData, { headers: CACHE_HEADERS });
      }
    }

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
