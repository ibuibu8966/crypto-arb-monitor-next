import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/logger";

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" };

type HistoryCacheEntry = {
  t: string; mexc: number | null; bitget: number | null; coinex: number | null;
  mxBg: number | null; mxCx: number | null; bgCx: number | null; max: number | null;
};

/** 数値を小数2桁に丸める（転送量削減） */
function round2(v: number | null): number | null {
  return v == null ? null : Math.round(v * 100) / 100;
}

/**
 * 24h専用の高速history API
 * spread_history_cacheテーブルから取得（メモリキャッシュ廃止 → ISRに任せる）
 */
export async function GET() {
  try {
    const cached = await prisma.spread_history_cache.findMany();
    const result: Record<string, HistoryCacheEntry[]> = {};
    for (const row of cached) {
      const history = row.history_json as HistoryCacheEntry[];
      if (Array.isArray(history) && history.length > 0) {
        result[row.symbol] = history.map((h) => ({
          t: h.t,
          mexc: round2(h.mexc),
          bitget: round2(h.bitget),
          coinex: round2(h.coinex),
          mxBg: round2(h.mxBg),
          mxCx: round2(h.mxCx),
          bgCx: round2(h.bgCx),
          max: round2(h.max),
        }));
      }
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
