import { SpreadRepository } from "@/repositories/spread.repository";
import type { SpreadTickDTO } from "@/types";

export async function getHistoryUseCase(
  symbol: string,
  hours: number = 24
): Promise<SpreadTickDTO[]> {
  const rows = await SpreadRepository.findHistory(symbol, hours);

  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    timestamp: r.timestamp.toISOString(),
    mexc: r.mexc,
    bitget: r.bitget,
    coinex: r.coinex,
    mxBgPct: r.mx_bg_pct,
    mxCxPct: r.mx_cx_pct,
    bgCxPct: r.bg_cx_pct,
    maxSpreadPct: r.max_spread_pct,
  }));
}
