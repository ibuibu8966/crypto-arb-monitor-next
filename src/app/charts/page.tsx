// ISR: 60秒キャッシュ → 2回目以降は静的HTML並の速度
export const revalidate = 60;

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { DynamicAllCharts } from "@/components/dynamic-charts";
import { prisma } from "@/lib/prisma";
import type { PairName } from "@/types";

/** 上位30銘柄のシンボルを取得 */
async function getTopSymbols(): Promise<string[]> {
  const top = await prisma.spread_stats_cache.findMany({
    where: { time_range: "24h" },
    orderBy: { avg_spread: "desc" },
    take: 30,
    select: { symbol: true },
  });
  return top.map((r) => r.symbol);
}

async function getFastStats() {
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

/** SSRでは上位30銘柄のみプリフェッチ（メモリ節約） */
async function getFastHistory(topSymbols: string[]) {
  const cached = await prisma.spread_history_cache.findMany({
    where: { symbol: { in: topSymbols } },
  });
  const result: Record<string, unknown[]> = {};
  for (const row of cached) {
    const history = row.history_json as unknown[];
    if (Array.isArray(history) && history.length > 0) {
      result[row.symbol] = history;
    }
  }
  return result;
}

export default async function ChartsPage() {
  const queryClient = getQueryClient();

  // 上位30銘柄を特定してからプリフェッチ
  const topSymbols = await getTopSymbols();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["stats", 24],
      queryFn: getFastStats,
    }),
    queryClient.prefetchQuery({
      queryKey: ["all-history-24h"],
      queryFn: () => getFastHistory(topSymbols),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DynamicAllCharts />
    </HydrationBoundary>
  );
}
