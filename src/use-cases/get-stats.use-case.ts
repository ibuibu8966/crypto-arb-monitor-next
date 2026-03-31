import { SpreadRepository } from "@/repositories/spread.repository";
import type { StatsDTO } from "@/types";

/** サーバーサイドメモリキャッシュ（stats APIは重いSQLなので30秒キャッシュ） */
const cache = new Map<string, { data: StatsDTO[]; expires: number }>();
const CACHE_TTL_MS = 30 * 1000;

export async function getStatsUseCase(
  hours: number = 24
): Promise<StatsDTO[]> {
  const key = `stats-${hours}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const data = await SpreadRepository.getStats(hours);
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}
