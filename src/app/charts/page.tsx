import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { getStatsUseCase } from "@/use-cases/get-stats.use-case";
import { DynamicAllCharts } from "@/components/dynamic-charts";

export default async function ChartsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["stats", 24],
    queryFn: () => getStatsUseCase(24),
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DynamicAllCharts />
    </HydrationBoundary>
  );
}
