import { SpreadRepository } from "@/repositories/spread.repository";
import type { SpreadTickDTO } from "@/types";

/** キャッシュJSON 1行の型 */
type CacheEntry = {
  t: string | null;
  mexc: number | null;
  bitget: number | null;
  coinex: number | null;
  mxBg: number | null;
  mxCx: number | null;
  bgCx: number | null;
  max: number | null;
};

export async function getHistoryUseCase(
  symbol: string,
  hours: number = 24
): Promise<SpreadTickDTO[]> {
  // 24hリクエストはキャッシュテーブルから取得（コレクターが事前計算済み）
  if (hours === 24) {
    const cached = await SpreadRepository.findHistoryFromCache(symbol);
    if (cached?.history_json) {
      const items = cached.history_json as CacheEntry[];
      if (items.length > 0) {
        return items.map((r, i) => ({
          id: i,
          symbol,
          timestamp: r.t ?? "",
          mexc: r.mexc,
          bitget: r.bitget,
          coinex: r.coinex,
          mxBgPct: r.mxBg,
          mxCxPct: r.mxCx,
          bgCxPct: r.bgCx,
          maxSpreadPct: r.max,
        }));
      }
    }
    // キャッシュが空ならフォールバック
  }

  // キャッシュ対象外の時間範囲 or フォールバック → spread_logから直接取得
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
