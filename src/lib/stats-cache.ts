import type { StatsDTO } from "@/types";

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
