import { findHistoryFromArchive } from "@/repositories/archive.repository";
import type { SpreadTickDTO } from "@/types";

/**
 * R2 アーカイブから指定銘柄の hours 時間ぶんの履歴を取得して DTO 化。
 * 注意: hours が大きいほど読み込むParquetファイル数が増える（メモリ負荷大）
 */
export async function getArchiveHistoryUseCase(
  symbol: string,
  hours: number = 720
): Promise<SpreadTickDTO[]> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  const rows = await findHistoryFromArchive(symbol, from, to);

  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    timestamp: r.timestamp,
    mexc: r.mexc,
    bitget: r.bitget,
    coinex: r.coinex,
    mxBgPct: r.mx_bg_pct,
    mxCxPct: r.mx_cx_pct,
    bgCxPct: r.bg_cx_pct,
    maxSpreadPct: r.max_spread_pct,
  }));
}
