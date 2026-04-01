"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { SummaryCards } from "./summary-cards";
import { SpreadTable } from "./spread-table";
import { SpreadBarChart } from "./spread-bar-chart";
import { useRealtimeWS } from "@/hooks/use-realtime-ws";
import type { RealtimeRow, StatsDTO } from "@/types";

async function fetchRealtime(): Promise<RealtimeRow[]> {
  const res = await fetch("/api/realtime");
  if (!res.ok) throw new Error("API error");
  return res.json();
}

async function fetchStats(): Promise<StatsDTO[]> {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("API error");
  return res.json();
}

export function Dashboard() {
  const router = useRouter();
  const { data: wsData, isConnected } = useRealtimeWS();
  const [minBandWidth, setMinBandWidth] = useState(0);

  // WS切断時はポーリングにフォールバック
  const { data: pollData, dataUpdatedAt } = useQuery({
    queryKey: ["realtime"],
    queryFn: fetchRealtime,
    refetchInterval: isConnected ? false : 30_000,
    enabled: !isConnected,
  });

  const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 5 * 60_000,
  });

  // WS接続中 → WSデータ、切断中 → ポーリングデータ
  const allRows = isConnected && wsData.length > 0 ? wsData : (pollData ?? []);
  const updatedAt = isConnected
    ? new Date().toISOString()
    : dataUpdatedAt
      ? new Date(dataUpdatedAt).toISOString()
      : "";

  // 値幅マップ: symbol → (signedMax - signedMin) * 0.6
  const bandWidthMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of statsData ?? []) {
      map.set(s.symbol, (s.signedMax - s.signedMin) * 0.6);
    }
    return map;
  }, [statsData]);

  // 値幅フィルター適用
  const rows = useMemo(() => {
    if (minBandWidth <= 0 || bandWidthMap.size === 0) return allRows;
    return allRows.filter((r) => {
      const bw = bandWidthMap.get(r.symbol);
      return bw === undefined || bw >= minBandWidth;
    });
  }, [allRows, bandWidthMap, minBandWidth]);

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
      <SummaryCards data={allRows} updatedAt={updatedAt} />
      <SpreadBarChart data={rows} />

      {/* 値幅フィルター */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-3 flex flex-wrap items-center gap-4">
        <span className="text-xs text-gray-400 font-semibold">値幅フィルター (80%-20%)</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">最小値幅:</span>
          <input
            type="number"
            min={0}
            step={0.001}
            value={minBandWidth}
            onChange={(e) => setMinBandWidth(Number(e.target.value))}
            className="bg-gray-800 text-gray-200 px-2 py-1 rounded text-xs w-24 outline-none focus:ring-1 focus:ring-blue-500 cursor-text"
          />
          <span className="text-xs text-gray-500">%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={minBandWidth}
          onChange={(e) => setMinBandWidth(Number(e.target.value))}
          className="w-32 cursor-pointer accent-blue-500"
        />
        <span className="text-xs text-gray-600">
          {rows.length} / {allRows.length} 銘柄表示中
        </span>
        {minBandWidth > 0 && (
          <button
            onClick={() => setMinBandWidth(0)}
            className="text-xs text-gray-500 hover:text-gray-300 underline cursor-pointer"
          >
            リセット
          </button>
        )}
      </div>

      <SpreadTable
        data={rows}
        onSymbolClick={(sym) => router.push(`/symbol/${sym}`)}
      />
    </div>
  );
}
