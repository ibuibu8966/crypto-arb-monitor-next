import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/logger";
import { getCachedAllHistory, setCacheAllHistory } from "@/lib/stats-cache";

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" };

type HistoryCacheEntry = {
  t: string; mexc: number | null; bitget: number | null; coinex: number | null;
  mxBg: number | null; mxCx: number | null; bgCx: number | null; max: number | null;
};

/**
 * 24h専用の高速history API
 * メモリキャッシュ → spread_history_cacheテーブルの順で返却
 * コレクターが事前計算したキャッシュを読むだけなので軽量
 */
export async function GET() {
  try {
    // 1. メモリキャッシュ（最速）
    const memCached = getCachedAllHistory();
    if (memCached && Object.keys(memCached).length > 0) {
      return NextResponse.json(memCached, { headers: CACHE_HEADERS });
    }

    // 2. DBキャッシュテーブルから取得
    const cached = await prisma.spread_history_cache.findMany();
    const result: Record<string, HistoryCacheEntry[]> = {};
    for (const row of cached) {
      const history = row.history_json as HistoryCacheEntry[];
      if (Array.isArray(history) && history.length > 0) {
        result[row.symbol] = history;
      }
    }

    if (Object.keys(result).length > 0) {
      setCacheAllHistory(result);
    }

    return NextResponse.json(result, { headers: CACHE_HEADERS });
  } catch (error) {
    captureError("fast-history", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
