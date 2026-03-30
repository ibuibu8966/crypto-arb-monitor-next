import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { getLogsUseCase } from "@/use-cases/get-logs.use-case";
import { LogViewer } from "@/features/logs/components/log-viewer";

export default async function LogsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["logs", 50, 0, ""],
    queryFn: () => getLogsUseCase({ limit: 50, offset: 0, hours: 24 }),
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LogViewer />
    </HydrationBoundary>
  );
}
