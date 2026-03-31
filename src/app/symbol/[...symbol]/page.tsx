import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { getStatsUseCase } from "@/use-cases/get-stats.use-case";
import { getHistoryUseCase } from "@/use-cases/get-history.use-case";
import { DynamicSymbolDetail } from "@/components/dynamic-charts";

type Props = {
  params: Promise<{ symbol: string[] }>;
};

export default async function SymbolPage({ params }: Props) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol.join("/"));

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["stats", 24],
      queryFn: () => getStatsUseCase(24),
    }),
    queryClient.prefetchQuery({
      queryKey: ["history", decoded, 24],
      queryFn: () => getHistoryUseCase(decoded, 24),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DynamicSymbolDetail symbol={decoded} />
    </HydrationBoundary>
  );
}
