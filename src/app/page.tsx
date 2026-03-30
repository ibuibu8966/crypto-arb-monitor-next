import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { getRealtimeUseCase } from "@/use-cases/get-realtime.use-case";
import { Dashboard } from "@/features/dashboard/components/dashboard";

export default async function HomePage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["realtime"],
    queryFn: getRealtimeUseCase,
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Dashboard />
    </HydrationBoundary>
  );
}
