"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SummaryCards } from "./summary-cards";
import { SpreadTable } from "./spread-table";
import { SpreadBarChart } from "./spread-bar-chart";
import { useRealtimeWS } from "@/hooks/use-realtime-ws";
import type { RealtimeRow } from "@/types";

async function fetchRealtime(): Promise<RealtimeRow[]> {
  const res = await fetch("/api/realtime");
  if (!res.ok) throw new Error("API error");
  return res.json();
}

export function Dashboard() {
  const router = useRouter();
  const { data: wsData, isConnected } = useRealtimeWS();

  // WS切断時はポーリングにフォールバック
  const { data: pollData, dataUpdatedAt } = useQuery({
    queryKey: ["realtime"],
    queryFn: fetchRealtime,
    refetchInterval: isConnected ? false : 30_000,
    enabled: !isConnected,
  });

  // WS接続中 → WSデータ、切断中 → ポーリングデータ
  const rows = isConnected && wsData.length > 0 ? wsData : (pollData ?? []);
  const updatedAt = isConnected
    ? new Date().toISOString()
    : dataUpdatedAt
      ? new Date(dataUpdatedAt).toISOString()
      : "";

  return (
    <div>
      {/* 接続状態インジケーター */}
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        {isConnected ? "リアルタイム接続中" : "ポーリング中（30秒間隔）"}
      </div>
      <SummaryCards data={rows} updatedAt={updatedAt} />
      <SpreadBarChart data={rows} />
      <SpreadTable
        data={rows}
        onSymbolClick={(sym) => router.push(`/symbol/${sym}`)}
      />
    </div>
  );
}
