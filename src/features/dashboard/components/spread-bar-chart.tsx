"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RealtimeRow } from "@/types";

type Props = {
  data: RealtimeRow[];
};

export function SpreadBarChart({ data }: Props) {
  const top20 = data
    .filter((r) => r.maxSpreadPct !== null)
    .sort((a, b) => (b.maxSpreadPct ?? 0) - (a.maxSpreadPct ?? 0))
    .slice(0, 20)
    .reverse();

  const chartData = top20.map((r) => ({
    symbol: r.symbol,
    spread: Number((r.maxSpreadPct ?? 0).toFixed(4)),
  }));

  const yMax =
    chartData.length > 0
      ? Math.max(...chartData.map((d) => d.spread)) * 1.05
      : 1;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
      <h2 className="text-sm font-bold text-gray-400 mb-3">差率 TOP20</h2>
      <ResponsiveContainer width="100%" height={500}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            type="number"
            domain={[0, yMax]}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(3)}%`}
          />
          <YAxis
            dataKey="symbol"
            type="category"
            width={75}
            tick={{ fill: "#d1d5db", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: 8,
              color: "#e5e7eb",
            }}
            formatter={(value: number) => [`${value.toFixed(4)}%`, "差率"]}
          />
          <Bar dataKey="spread" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => {
              const color =
                entry.spread >= 0.1
                  ? "#ef4444"
                  : entry.spread >= 0.05
                    ? "#f97316"
                    : "#22c55e";
              return <Cell key={entry.symbol} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
