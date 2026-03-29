import { SpreadRepository } from "@/repositories/spread.repository";
import type { RealtimeRow } from "@/types";

const MAX_SPREAD_FILTER = 50; // contractSize異常値をフィルター

export async function getRealtimeUseCase(): Promise<RealtimeRow[]> {
  const rows = await SpreadRepository.findLatest();

  return rows
    .filter(
      (r) =>
        r.max_spread_pct === null ||
        Math.abs(r.max_spread_pct) <= MAX_SPREAD_FILTER
    )
    .map((r) => ({
      symbol: r.symbol,
      mexc: r.mexc,
      bitget: r.bitget,
      coinex: r.coinex,
      mxBgPct: r.mx_bg_pct,
      mxCxPct: r.mx_cx_pct,
      bgCxPct: r.bg_cx_pct,
      maxSpreadPct: r.max_spread_pct,
      timestamp: r.timestamp.toISOString(),
    }));
}
