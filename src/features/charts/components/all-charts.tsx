"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, memo, useEffect } from "react";
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
  // 24hはfast API（事前計算済みキャッシュから一発取得）
  const url = hours === 24 ? "/api/fast-stats" : `/api/stats?hours=${hours}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API error");
  return res.json();
}

async function fetchHistory(
  symbol: string,
  hours: number
): Promise<SpreadTickDTO[]> {
  const res = await fetch(
    `/api/history?symbol=${encodeURIComponent(symbol)}&hours=${hours}`
  );
  if (!res.ok) throw new Error("API error");
  return res.json();
}

/** 全銘柄のヒストリーを一括取得（24h専用） */
type HistoryCacheEntry = {
  t: string;
  mexc: number | null;
  bitget: number | null;
  coinex: number | null;
  mxBg: number | null;
  mxCx: number | null;
  bgCx: number | null;
  max: number | null;
};

async function fetchAllHistory(): Promise<Record<string, HistoryCacheEntry[]>> {
  const res = await fetch("/api/fast-history");
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

const MiniChart = memo(function MiniChart({
  symbol,
  hours,
  onClick,
  bestPair,
  crossings20,
  crossings80,
  statsPosition,
  arbScore,
  delayMs = 0,
  cachedHistory,
}: {
  symbol: string;
  hours: number;
  onClick: () => void;
  bestPair: PairName;
  crossings20: number;
  crossings80: number;
  statsPosition: number;
  arbScore?: number;
  delayMs?: number;
  cachedHistory?: HistoryCacheEntry[];
}) {
  const hasCached = !!cachedHistory;

  const [ready, setReady] = useState(hasCached || delayMs === 0);
  useEffect(() => {
    if (!hasCached && delayMs > 0) {
      const t = setTimeout(() => setReady(true), delayMs);
      return () => clearTimeout(t);
    }
  }, [delayMs, hasCached]);

  const { data } = useQuery({
    queryKey: ["history", symbol, hours],
    queryFn: () => fetchHistory(symbol, hours),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    enabled: ready && !hasCached,
  });

  const chartData = useMemo(() => {
    // 24h事前計算済みキャッシュがあればそれを使う
    if (cachedHistory) {
      return cachedHistory.map((r) => {
        const pairVal = bestPair === "mx_bg" ? r.mxBg : bestPair === "mx_cx" ? r.mxCx : r.bgCx;
        return {
          t: new Date(r.t).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
          v: pairVal ?? 0,
        };
      });
    }
    if (!data) return [];
    return data.map((r) => ({
      t: new Date(r.timestamp).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      v: getPairValue(r, bestPair),
    }));
  }, [data, bestPair, cachedHistory]);

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
        {arbScore != null && arbScore > 0 && (
          <span className="font-normal text-yellow-500 ml-1">
            ★{arbScore.toFixed(2)}
          </span>
        )}
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
  const [visibleCount, setVisibleCount] = useState(20);
  const [hours, setHours] = useState(24);
  const [cols, setCols] = useState(1);
  const [ranking, setRanking] = useState<"position" | "crossings" | "spreadMax" | "spreadMin" | "arbScore">("arbScore");
  const [minBandWidth, setMinBandWidth] = useState(0);

  const is24h = hours === 24;

  const { data: stats } = useQuery({
    queryKey: ["stats", hours],
    queryFn: async (ctx) => {
      const data = await fetchStats((ctx.queryKey[1] as number));
      const withScore = data.filter(s => (s.arbScore ?? 0) > 0);
      console.log(`[arbScore debug] total=${data.length} withScore=${withScore.length} top5=`, data.slice(0,5).map(s => ({ symbol: s.symbol, arbScore: s.arbScore })));
      return data;
    },
    refetchInterval: is24h ? 60 * 1000 : 30 * 1000,
  });

  // 24h時は全銘柄のヒストリーを一括取得（爆速表示用）
  const { data: allHistory } = useQuery({
    queryKey: ["all-history-24h"],
    queryFn: fetchAllHistory,
    refetchInterval: 60 * 1000,
    staleTime: 50 * 1000,
    enabled: is24h,
  });


  const filtered = useMemo(() => {
    if (!stats) return [];
    const sorted = stats
      .filter((s) => {
        if (minBandWidth > 0 && (s.signedMax - s.signedMin) < minBandWidth) return false;
        return true;
      })
      .sort((a, b) => {
        switch (ranking) {
          case "crossings":
            return (b.crossings80 + b.crossings20) - (a.crossings80 + a.crossings20);
          case "spreadMax":
            return b.maxSpread - a.maxSpread;
          case "spreadMin":
            return b.minSpread - a.minSpread;
          case "arbScore":
            return (b.arbScore ?? 0) - (a.arbScore ?? 0);
          case "position":
          default:
            return Math.abs(b.currentPosition - 50) - Math.abs(a.currentPosition - 50);
        }
      });
    return sorted;
  }, [stats, minBandWidth, ranking]);

  return (
    <div>
      {/* フィルター */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4 bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl px-5 py-3.5">
        {/* 期間 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">期間</span>
          <div className="flex bg-gray-800/80 rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.hours}
                onClick={() => setHours(p.hours)}
                className={`px-2.5 py-1 text-xs rounded-md cursor-pointer transition-all ${
                  hours === p.hours
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 区切り線 */}
        <div className="hidden sm:block w-px h-6 bg-gray-700" />

        {/* 列数 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">列数</span>
          <div className="flex bg-gray-800/80 rounded-lg p-0.5">
            {[1, 2, 4].map((n) => (
              <button
                key={n}
                onClick={() => setCols(n)}
                className={`px-3 py-1 text-xs rounded-md cursor-pointer transition-all ${
                  cols === n
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 区切り線 */}
        <div className="hidden sm:block w-px h-6 bg-gray-700" />

        {/* ランキング */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">ランキング</span>
          <div className="flex bg-gray-800/80 rounded-lg p-0.5">
            {([
              { key: "arbScore", label: "総合スコア" },
              { key: "position", label: "エントリー機会" },
              { key: "crossings", label: "20%/80%到達回数" },
              { key: "spreadMax", label: "最大値幅" },
              { key: "spreadMin", label: "最小値幅" },
            ] as const).map((r) => (
              <button
                key={r.key}
                onClick={() => setRanking(r.key)}
                className={`px-2.5 py-1 text-xs rounded-md cursor-pointer transition-all whitespace-nowrap ${
                  ranking === r.key
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 区切り線 */}
        <div className="hidden sm:block w-px h-6 bg-gray-700" />

        {/* 値幅フィルター */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            最小値幅フィルター <span className="text-white font-medium">{minBandWidth.toFixed(2)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={minBandWidth}
            onChange={(e) => setMinBandWidth(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* 区切り線 */}
        <div className="hidden sm:block w-px h-6 bg-gray-700" />

        {/* 表示数 */}
        <div className="flex items-center">
          <span className="text-xs text-gray-400">
            表示 <span className="text-white font-medium">{Math.min(visibleCount, filtered.length)}</span>
            <span className="text-gray-500"> / {filtered.length}件</span>
          </span>
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
        {filtered.slice(0, visibleCount).map((s, i) => (
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
            arbScore={s.arbScore}
            delayMs={is24h ? 0 : i * 500}
            cachedHistory={is24h ? allHistory?.[s.symbol] : undefined}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          条件に一致する銘柄がありません
        </div>
      )}

      {visibleCount < filtered.length && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + 20)}
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg border border-gray-700 transition-colors cursor-pointer"
          >
            もっと見る（残り {filtered.length - visibleCount}件）
          </button>
        </div>
      )}
    </div>
  );
}
