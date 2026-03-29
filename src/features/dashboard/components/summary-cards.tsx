"use client";

import type { RealtimeRow } from "@/types";

type Props = {
  data: RealtimeRow[];
  updatedAt: string;
};

export function SummaryCards({ data, updatedAt }: Props) {
  const totalSymbols = data.length;
  const topRow = data[0];
  const alertCount = data.filter(
    (r) => r.maxSpreadPct && r.maxSpreadPct >= 0.1
  ).length;
  const threeExchangeCount = data.filter(
    (r) => r.mexc !== null && r.bitget !== null && r.coinex !== null
  ).length;

  const cards = [
    {
      label: "最終更新",
      value: updatedAt
        ? new Date(updatedAt).toLocaleTimeString("ja-JP")
        : "-",
      color: "text-blue-400",
    },
    {
      label: "監視銘柄数",
      value: totalSymbols.toString(),
      color: "text-green-400",
    },
    {
      label: "最大差率",
      value: topRow
        ? `${topRow.maxSpreadPct?.toFixed(3)}% (${topRow.symbol})`
        : "-",
      color: "text-yellow-400",
    },
    {
      label: "アラート (≥0.1%)",
      value: alertCount.toString(),
      color: alertCount > 0 ? "text-red-400" : "text-gray-400",
    },
    {
      label: "3取引所共通",
      value: threeExchangeCount.toString(),
      color: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-gray-900 border border-gray-800 rounded-lg p-4"
        >
          <div className="text-xs text-gray-500 mb-1">{c.label}</div>
          <div className={`text-lg font-bold ${c.color} truncate`}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
