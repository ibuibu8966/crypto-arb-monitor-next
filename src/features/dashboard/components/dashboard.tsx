"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SummaryCards } from "./summary-cards";
import { SpreadTable } from "./spread-table";
import { SpreadBarChart } from "./spread-bar-chart";
import type { RealtimeRow } from "@/types";

async function fetchRealtime(): Promise<RealtimeRow[]> {
  const res = await fetch("/api/realtime");
  if (!res.ok) throw new Error("API error");
  return res.json();
}

export function Dashboard() {
  const router = useRouter();
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["realtime"],
    queryFn: fetchRealtime,
    refetchInterval: 30_000,
  });

  const rows = data ?? [];
  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toISOString()
    : "";

  return (
    <div>
      <SummaryCards data={rows} updatedAt={updatedAt} />
      <SpreadBarChart data={rows} />
      <SpreadTable
        data={rows}
        onSymbolClick={(sym) => router.push(`/symbol/${sym}`)}
      />
    </div>
  );
}
