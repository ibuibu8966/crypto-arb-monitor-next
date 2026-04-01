"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { StatsDTO } from "@/types";

const TIME_RANGES = [
  { label: "1H", hours: 1 },
  { label: "4H", hours: 4 },
  { label: "12H", hours: 12 },
  { label: "24H", hours: 24 },
  { label: "1W", hours: 168 },
  { label: "1M", hours: 720 },
];

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 10
      ? "text-emerald-400 bg-emerald-500/10"
      : score >= 3
      ? "text-yellow-400 bg-yellow-500/10"
      : "text-gray-400 bg-gray-800";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${color}`}>
      {score.toFixed(3)}
    </span>
  );
}

function VolBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 font-mono">
        {value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toFixed(0)}
      </span>
    </div>
  );
}

export function RankingTable() {
  const [hours, setHours] = useState(24);

  const { data, isLoading, error } = useQuery<StatsDTO[]>({
    queryKey: ["ranking", hours],
    queryFn: async () => {
      const res = await fetch(`/api/ranking?hours=${hours}`);
      if (!res.ok) throw new Error("API error");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const maxExecVol = Math.max(...(data?.map((d) => d.execVolume) ?? [0]));

  return (
    <div>
      {/* 時間範囲セレクター */}
      <div className="flex items-center gap-1 mb-4">
        {TIME_RANGES.map((r) => (
          <button
            key={r.hours}
            onClick={() => setHours(r.hours)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
              hours === r.hours
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* テーブル */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-500 text-sm">読み込み中...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 text-sm">
          データ取得に失敗しました
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          <p>スコアデータがありません</p>
          <p className="text-xs mt-2 text-gray-600">
            collector.py の板データ収集が完了すると表示されます（起動後約5分）
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-800">
                <th className="pb-3 pr-4 text-xs text-gray-500 font-medium w-10">#</th>
                <th className="pb-3 pr-4 text-xs text-gray-500 font-medium">Symbol</th>
                <th className="pb-3 pr-4 text-xs text-gray-500 font-medium">Score</th>
                <th className="pb-3 pr-4 text-xs text-gray-500 font-medium">Avg%</th>
                <th className="pb-3 pr-4 text-xs text-gray-500 font-medium">Cost Ratio</th>
                <th className="pb-3 pr-4 text-xs text-gray-500 font-medium">Rev Prob</th>
                <th className="pb-3 pr-4 text-xs text-gray-500 font-medium">Half Life</th>
                <th className="pb-3 pr-4 text-xs text-gray-500 font-medium">Exec Vol (USDT)</th>
                <th className="pb-3 text-xs text-gray-500 font-medium">Vol Stab</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {data.map((row, i) => {
                const sym = row.symbol.split("/")[0];
                return (
                  <tr key={row.symbol} className="hover:bg-gray-900/50 transition-colors">
                    <td className="py-3 pr-4 text-gray-600 text-xs">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/symbol/${encodeURIComponent(row.symbol)}`}
                        className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                      >
                        {sym}
                      </Link>
                      <span className="ml-1.5 text-xs text-gray-600">
                        {row.bestPair.replace("_", "/")}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <ScoreBadge score={row.arbScore} />
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-300">
                      {row.avgSpread.toFixed(3)}%
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      <span
                        className={
                          row.costRatio >= 2 ? "text-emerald-400" : "text-gray-500"
                        }
                      >
                        {row.costRatio.toFixed(1)}x
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      <span
                        className={
                          row.reversionProb >= 0.5 ? "text-emerald-400" : "text-gray-400"
                        }
                      >
                        {(row.reversionProb * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-300">
                      {row.halfLife > 0 ? `${row.halfLife.toFixed(0)}tick` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <VolBar value={row.execVolume} max={maxExecVol} />
                    </td>
                    <td className="py-3 font-mono text-xs text-gray-500">
                      {row.volStability > 0 ? row.volStability.toFixed(4) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
