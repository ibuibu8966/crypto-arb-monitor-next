import type { StatsDTO, SpreadTickDTO } from "@/types";

/** サーバーサイドメモリキャッシュ（stats APIは重いSQLなので30秒キャッシュ） */
const cache = new Map<string, { data: StatsDTO[]; expires: number }>();
const CACHE_TTL_MS = 30 * 1000;

export function getCached(key: string): StatsDTO[] | null {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  return null;
}

export function setCache(key: string, data: StatsDTO[]): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

/** history用メモリキャッシュ（60秒TTL） */
const historyCache = new Map<string, { data: SpreadTickDTO[]; expires: number }>();
const HISTORY_CACHE_TTL_MS = 60 * 1000;

export function getCachedHistory(symbol: string, hours: number): SpreadTickDTO[] | null {
  const key = `history:${symbol}:${hours}`;
  const cached = historyCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  return null;
}

export function setCacheHistory(symbol: string, hours: number, data: SpreadTickDTO[]): void {
  const key = `history:${symbol}:${hours}`;
  historyCache.set(key, { data, expires: Date.now() + HISTORY_CACHE_TTL_MS });
}

/** fast-history用メモリキャッシュ（全銘柄一括、60秒TTL） */
type HistoryCacheEntry = {
  t: string; mexc: number | null; bitget: number | null; coinex: number | null;
  mxBg: number | null; mxCx: number | null; bgCx: number | null; max: number | null;
};
let allHistoryCache: { data: Record<string, HistoryCacheEntry[]>; expires: number } | null = null;

export function getCachedAllHistory(): Record<string, HistoryCacheEntry[]> | null {
  if (allHistoryCache && allHistoryCache.expires > Date.now()) {
    return allHistoryCache.data;
  }
  return null;
}

export function setCacheAllHistory(data: Record<string, HistoryCacheEntry[]>): void {
  allHistoryCache = { data, expires: Date.now() + HISTORY_CACHE_TTL_MS };
}
