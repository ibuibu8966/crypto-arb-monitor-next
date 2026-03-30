"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, memo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { StatsDTO, SpreadTickDTO, PairName } from "@/types";

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
    `/api/history?symbol=${encodeURIComponent(symbol)}&hours=${hours}&limit=100`
  );
  if (!res.ok) throw new Error("API error");
  return res.json();
}

function getPairValue(r: SpreadTickDTO, pair: PairName): number {
  switch (pair) {
    case "mx_bg": return r.mxBgPct ?? 0;
    case "mx_cx": return r.mxCxPct ?? 0;
    case "bg_cx": return r.bgCxPct ?? 0;
  }
}

const PAIR_LABELS: Record<PairName, string> = {
  mx_bg: "MX-BG",
  mx_cx: "MX-CX",
  bg_cx: "BG-CX",
};

const PERIODS = [
  { label: "1h", hours: 1 },
  { label: "4h", hours: 4 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "1W", hours: 168 },
  { label: "1M", hours: 720 },
  { label: "1Y", hours: 8760 },
];

/** 画面内に入ったかどうかを検知するフック */
function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, inView };
}

const MiniChart = memo(function MiniChart({
  symbol,
  hours,
  onClick,
  bestPair,
  crossings20,
  crossings80,
  statsPosition,
}: {
  symbol: string;
  hours: number;
  onClick: () => void;
  bestPair: PairName;
  crossings20: number;
  crossings80: number;
  statsPosition: number;
}) {
  const { ref, inView } = useInView();

  const { data } = useQuery({
    queryKey: ["history", symbol, hours],
    queryFn: () => fetchHistory(symbol, hours),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    enabled: inView,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      t: new Date(r.timestamp).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      v: getPairValue(r, bestPair),
    }));
  }, [data, bestPair]);

  const { yMin, yMax, line20, line80, yTicks, dataMin, dataMax } = useMemo(() => {
    if (chartData.length === 0)
      return { yMin: -1, yMax: 1, line20: 0, line80: 0, yTicks: [0], dataMin: 0, dataMax: 0 };

    const values = chartData.map((d) => d.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const l20 = min + range * 0.2;
    const l80 = min + range * 0.8;

    const ticks = [...new Set([max, l80, l20, min, 0])].sort((a, b) => a - b);

    return {
      yMin: min - range * 0.05,
      yMax: max + range * 0.05,
      line20: l20,
      line80: l80,
      yTicks: ticks,
      dataMin: min,
      dataMax: max,
    };
  }, [chartData]);

  const currentPosition = statsPosition;

  const posColor =
    currentPosition >= 80 || currentPosition <= 20
      ? "#22c55e"
      : currentPosition >= 60 || currentPosition <= 40
        ? "#f59e0b"
        : "#6b7280";

  return (
    <div
      ref={ref}
      className="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 cursor-pointer hover:border-gray-600 transition-colors"
      onClick={onClick}
    >
      <div className="text-xs font-bold text-gray-300 mb-1 truncate">
        {symbol}
        <span
          className="ml-1.5 font-mono font-medium"
          style={{ color: posColor }}
        >
          [{Math.round(currentPosition)}%]
        </span>
        <span className="font-normal text-gray-500 ml-1">
          (<span className="text-red-400">↑80%:{crossings80}</span> / <span className="text-green-400">↓20%:{crossings20}</span>)
        </span>
        <span className="font-normal text-gray-600 ml-1">
          {PAIR_LABELS[bestPair]}
        </span>
      </div>
      {chartData.length === 0 ? (
        <div className="h-[200px] bg-gray-800/50 rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={yTicks}
              tickCount={5}
              allowDataOverflow
              tick={{ fontSize: 9, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => `${v.toFixed(2)}%`}
            />
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
            {/* 0%ライン（ゼロスプレッド位置） */}
            <ReferenceLine
              y={0}
              stroke="#4b5563"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
            <ReferenceLine
              y={line80}
              stroke="#ef4444"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{ value: "80%", position: "right", fontSize: 8, fill: "#ef4444" }}
            />
            <ReferenceLine
              y={line20}
              stroke="#22c55e"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{ value: "20%", position: "right", fontSize: 8, fill: "#22c55e" }}
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
});

export function AllCharts() {
  const router = useRouter();
  const [count, setCount] = useState(20); // デフォルト20銘柄（DB負荷軽減）
  const [hours, setHours] = useState(24);
  const [minAvg, setMinAvg] = useState(0.01);
  const [maxCap, setMaxCap] = useState(10);
  const [cols, setCols] = useState(1); // カード列数: 1, 2, 4

  const { data: stats } = useQuery({
    queryKey: ["stats", hours],
    queryFn: () => fetchStats(hours),
    refetchInterval: 30 * 1000,
  });


  const filtered = useMemo(() => {
    if (!stats) return [];
    const sorted = stats
      .filter((s) => s.avgSpread >= minAvg && s.maxSpread <= maxCap)
      .sort((a, b) => {
        const distA = Math.abs(a.currentPosition - 50);
        const distB = Math.abs(b.currentPosition - 50);
        return distB - distA;
      });
    return count === 0 ? sorted : sorted.slice(0, count);
  }, [stats, count, minAvg, maxCap]);

  return (
    <div>
      {/* フィルター */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4 bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            表示数: {count === 0 ? "全通貨" : count}
          </label>
          <input
            type="range"
            min={0}
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
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.hours}
                onClick={() => setHours(p.hours)}
                className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                  hours === p.hours
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
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
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            列数
          </label>
          <div className="flex gap-1">
            {[1, 2, 4].map((n) => (
              <button
                key={n}
                onClick={() => setCols(n)}
                className={`px-3 py-1 text-xs rounded cursor-pointer transition-colors ${
                  cols === n
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* チャートグリッド */}
      <div className={`grid gap-3 ${
        cols === 4 ? "grid-cols-2 lg:grid-cols-4" :
        cols === 2 ? "grid-cols-1 sm:grid-cols-2" :
        "grid-cols-1"
      }`}>
        {!stats && [...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3 animate-pulse">
            <div className="h-4 w-48 bg-gray-800 rounded mb-3" />
            <div className="h-[200px] bg-gray-800/50 rounded" />
          </div>
        ))}
        {filtered.map((s) => {
          return (
            <MiniChart
              key={s.symbol}
              symbol={s.symbol}
              hours={hours}
              onClick={() =>
                router.push(`/symbol/${encodeURIComponent(s.symbol)}`)
              }
              bestPair={s.bestPair}
              crossings20={s.crossings20}
              crossings80={s.crossings80}
              statsPosition={s.currentPosition}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          条件に一致する銘柄がありません
        </div>
      )}
    </div>
  );
}
