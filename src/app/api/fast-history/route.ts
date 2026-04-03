import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/logger";

/**
 * 24h専用の高速history API
 * spread_history_cacheから全銘柄のヒストリーをまとめて返却
 * レスポンス: { [symbol]: SpreadTickDTO[] }
 */
export async function GET() {
  try {
    const cached = await prisma.spread_history_cache.findMany();

    const result: Record<string, unknown[]> = {};
    for (const row of cached) {
      const history = row.history_json as unknown[];
      if (Array.isArray(history) && history.length > 0) {
        result[row.symbol] = history;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    captureError("fast-history", error);
    return NextResponse.json(
      { error: "データ取得に失敗��ました" },
      { status: 500 }
    );
  }
}
