import { SpreadRepository } from "@/repositories/spread.repository";
import type { StatsDTO } from "@/types";

export async function getStatsUseCase(
  hours: number = 24
): Promise<StatsDTO[]> {
  return SpreadRepository.getStats(hours);
}
