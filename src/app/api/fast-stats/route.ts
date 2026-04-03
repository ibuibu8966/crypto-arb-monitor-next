import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { StatsDTO, PairName } from "@/types";
import { captureError } from "@/lib/logger";

/**
 * 24h専用の高速stats API
 * spread_stats_cacheから全銘柄を一発返却（SQL計算ゼロ）
 */
export async function GET() {
  try {
    const cached = await prisma.spread_stats_cache.findMany({
      where: { time_range: "24h" },
      orderBy: { avg_spread: "desc" },
    });

    const data: StatsDTO[] = cached.map((r) => ({
      symbol: r.symbol,
      avgSpread: r.avg_spread ?? 0,
      maxSpread: r.max_spread ?? 0,
      minSpread: r.min_spread ?? 0,
      stdSpread: r.std_spread ?? 0,
      count: r.count ?? 0,
      bestPair: (r.best_pair ?? "mx_bg") as PairName,
      crossings20: r.crossings_20 ?? 0,
      crossings80: r.crossings_80 ?? 0,
      totalCrossings: (r.crossings_20 ?? 0) + (r.crossings_80 ?? 0),
      signedMin: r.signed_min ?? 0,
      signedMax: r.signed_max ?? 0,
      currentPosition: r.current_pos ?? 50,
      reversionProb: (r as unknown as { reversion_prob?: number }).reversion_prob ?? 0,
      halfLife: (r as unknown as { half_life?: number }).half_life ?? 0,
      costRatio: (r as unknown as { cost_ratio?: number }).cost_ratio ?? 0,
      execVolume: (r as unknown as { exec_volume?: number }).exec_volume ?? 0,
      volStability: (r as unknown as { vol_stability?: number }).vol_stability ?? 0,
      arbScore: (r as unknown as { arb_score?: number }).arb_score ?? 0,
    }));

    return NextResponse.json(data);
  } catch (error) {
    captureError("fast-stats", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
