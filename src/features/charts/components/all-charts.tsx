"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { StatsDTO, SpreadTickDTO } from "@/types";

async function fetchStats(hours: number): Promise<StatsDTO[]> {
  const res = await fetch(`/api/stats?hours=${hours}`);
  if (!res.ok) throw new Error("API error");
  return res.json();
}

async function fetchHistory(
  symbol: string,
  hours: number
): Promise<SpreadTickDTO[]> {
  const res = await fetch(
    `/api/history?symbol=${encodeURIComponent(symbol)}&hours=${hours}&limit=500`
  );
  if (!res.ok) throw new Error("API error");
  return res.json();
}

function MiniChart({
  symbol,
  hours,
  onClick,
}: {
  symbol: string;
  hours: number;
  onClick: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["history", symbol, hours],
    queryFn: () => fetchHistory(symbol, hours),
    staleTime: 5 * 60 * 1000,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      t: new Date(r.timestamp).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      v: r.maxSpreadPct ?? 0,
    }));
  }, [data]);

  const yMax =
    chartData.length > 0
      ? Math.max(...chartData.map((d) => Math.abs(d.v))) * 1.05
      : 1;

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 cursor-pointer hover:border-gray-600 transition-colors"
      onClick={onClick}
    >
      <div className="text-xs font-bold text-gray-300 mb-1 truncate">
        {symbol}
      </div>
      {chartData.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gray-600 text-xs">
          ...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, yMax]} hide />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: 6,
                fontSize: 11,
                color: "#e5e7eb",
              }}
              formatter={(value: number) => [`${value.toFixed(4)}%`, "差率"]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#3b82f6"
              strokeWidth={2}
              fill={`url(#grad-${symbol})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function AllCharts() {
  const router = useRouter();
  const [count, setCount] = useState(20);
  const [hours, setHours] = useState(24);
  const [minAvg, setMinAvg] = useState(0.01);
  const [maxCap, setMaxCap] = useState(10);

  const { data: stats } = useQuery({
    queryKey: ["stats", hours],
    queryFn: () => fetchStats(hours),
  });

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats
      .filter((s) => s.avgSpread >= minAvg && s.maxSpread <= maxCap)
      .slice(0, count);
  }, [stats, count, minAvg, maxCap]);

  return (
    <div>
      {/* フィルター */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            表示数: {count}
          </label>
          <input
            type="range"
            min={5}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            期間
          </label>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="bg-gray-800 text-gray-200 text-xs px-2 py-1.5 rounded w-full"
          >
            <option value={1}>1h</option>
            <option value={6}>6h</option>
            <option value={24}>24h</option>
            <option value={168}>7d</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            最小平均: {minAvg}%
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={minAvg}
            onChange={(e) => setMinAvg(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            最大上限: {maxCap}%
          </label>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={maxCap}
            onChange={(e) => setMaxCap(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* チャートグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((s) => (
          <MiniChart
            key={s.symbol}
            symbol={s.symbol}
            hours={hours}
            onClick={() =>
              router.push(`/symbol/${encodeURIComponent(s.symbol)}`)
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          条件に一致する銘柄がありません
        </div>
      )}
    </div>
  );
}
