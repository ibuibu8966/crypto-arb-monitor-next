import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { captureError } from "@/lib/logger";
import { getCachedAllHistory, setCacheAllHistory } from "@/lib/stats-cache";

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" };

type HistoryCacheEntry = {
  t: string; mexc: number | null; bitget: number | null; coinex: number | null;
  mxBg: number | null; mxCx: number | null; bgCx: number | null; max: number | null;
};

/**
 * 24h専用の高速history API
 * spread_history_cacheから全銘柄のヒストリーをまとめて返却
 * キャッシュが空の場合はspread_logから1バッチクエリで取得（フォールバック）
 */
export async function GET() {
  try {
    // 1. メモリキャッシュ（最速）
    const memCached = getCachedAllHistory();
    if (memCached && Object.keys(memCached).length > 0) {
      return NextResponse.json(memCached, { headers: CACHE_HEADERS });
    }

    // 2. DBキャッシュテーブル
    const cached = await prisma.spread_history_cache.findMany();
    if (cached.length > 0) {
      const result: Record<string, HistoryCacheEntry[]> = {};
      for (const row of cached) {
        const history = row.history_json as HistoryCacheEntry[];
        if (Array.isArray(history) && history.length > 0) {
          result[row.symbol] = history;
        }
      }
      if (Object.keys(result).length > 0) {
        setCacheAllHistory(result);
        return NextResponse.json(result, { headers: CACHE_HEADERS });
      }
    }

    // 3. フォールバック: spread_logから1バッチクエリ（キャッシュが空の場合）
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<
      {
        symbol: string;
        timestamp: Date;
        mexc: number | null;
        bitget: number | null;
        coinex: number | null;
        mx_bg_pct: number | null;
        mx_cx_pct: number | null;
        bg_cx_pct: number | null;
        max_spread_pct: number | null;
      }[]
    >(Prisma.sql`
      SELECT symbol, timestamp, mexc, bitget, coinex,
             mx_bg_pct, mx_cx_pct, bg_cx_pct, max_spread_pct
      FROM spread_log
      WHERE timestamp >= ${since}
      ORDER BY symbol, timestamp ASC
    `);

    const result: Record<string, HistoryCacheEntry[]> = {};
    for (const r of rows) {
      if (!result[r.symbol]) result[r.symbol] = [];
      result[r.symbol].push({
        t: r.timestamp.toISOString(),
        mexc: r.mexc,
        bitget: r.bitget,
        coinex: r.coinex,
        mxBg: r.mx_bg_pct,
        mxCx: r.mx_cx_pct,
        bgCx: r.bg_cx_pct,
        max: r.max_spread_pct,
      });
    }

    setCacheAllHistory(result);
    return NextResponse.json(result, { headers: CACHE_HEADERS });
  } catch (error) {
    captureError("fast-history", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
