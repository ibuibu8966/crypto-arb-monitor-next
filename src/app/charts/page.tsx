export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { DynamicAllCharts } from "@/components/dynamic-charts";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import type { PairName } from "@/types";

async function _getFastStats() {
  const cached = await prisma.spread_stats_cache.findMany({
    where: { time_range: "24h" },
    orderBy: { avg_spread: "desc" },
  });
  return cached.map((r) => ({
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
}

// statsのみ60秒キャッシュ（軽量データ）
const getFastStats = unstable_cache(_getFastStats, ["fast-stats"], { revalidate: 60 });

// historyはSSRから完全に外す（クライアントサイドでfetch）
// → OOM解消 + stats表示は爆速
export default async function ChartsPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["stats", 24],
    queryFn: getFastStats,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DynamicAllCharts />
    </HydrationBoundary>
  );
}
