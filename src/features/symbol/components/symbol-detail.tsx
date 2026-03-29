"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SpreadTickDTO, StatsDTO } from "@/types";

async function fetchStats(): Promise<StatsDTO[]> {
  const res = await fetch("/api/stats?hours=24");
  if (!res.ok) throw new Error("API error");
  return res.json();
}

const PERIODS = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

const COLORS = {
  mxBg: "#3b82f6",
  mxCx: "#ef4444",
  bgCx: "#22c55e",
};

const LINE_KEYS = ["mxBg", "mxCx", "bgCx"] as const;
type LineKey = (typeof LINE_KEYS)[number];
const LINE_LABELS: Record<LineKey, string> = {
  mxBg: "MX-BG",
  mxCx: "MX-CX",
  bgCx: "BG-CX",
};

const MIN_VISIBLE_POINTS = 10;
const ZOOM_FACTOR = 0.15;

async function fetchHistory(
  symbol: string,
  hours: number
): Promise<SpreadTickDTO[]> {
  const res = await fetch(
    `/api/history?symbol=${encodeURIComponent(symbol)}&hours=${hours}&limit=2000`
  );
  if (!res.ok) throw new Error("API error");
  return res.json();
}

type Props = {
  symbol: string;
};

export function SymbolDetail({ symbol }: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState(24);
  const [visibleLines, setVisibleLines] = useState<Record<LineKey, boolean>>({
    mxBg: true,
    mxCx: true,
    bgCx: true,
  });

  // ズーム状態（インデックスベース）
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);

  // パン用
  const [isPanning, setIsPanning] = useState(false);
  const panStartX = useRef<number>(0);
  const panStartRange = useRef<[number, number]>([0, 0]);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  // 銘柄リスト取得（ナビゲーション用）
  const { data: statsList } = useQuery({
    queryKey: ["stats", 24],
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000,
  });

  const symbolList = useMemo(
    () => (statsList ?? []).map((s) => s.symbol),
    [statsList]
  );
  const currentIdx = symbolList.indexOf(symbol);
  const prevSymbol =
    symbolList.length > 0 && currentIdx > 0
      ? symbolList[currentIdx - 1]
      : symbolList.length > 0
        ? symbolList[symbolList.length - 1]
        : null;
  const nextSymbol =
    symbolList.length > 0 && currentIdx < symbolList.length - 1
      ? symbolList[currentIdx + 1]
      : symbolList.length > 0
        ? symbolList[0]
        : null;

  const { data, isLoading } = useQuery({
    queryKey: ["history", symbol, period],
    queryFn: () => fetchHistory(symbol, period),
    refetchInterval: 60_000,
  });

  const rows = data ?? [];

  const chartData = useMemo(
    () =>
      rows.map((r, i) => ({
        time: new Date(r.timestamp).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        idx: i,
        mxBg: r.mxBgPct,
        mxCx: r.mxCxPct,
        bgCx: r.bgCxPct,
      })),
    [rows]
  );

  // ズーム範囲のデータ
  const zoomedData = useMemo(() => {
    if (zoomStart === null || zoomEnd === null) return chartData;
    return chartData.slice(zoomStart, zoomEnd + 1);
  }, [chartData, zoomStart, zoomEnd]);

  const isZoomed = zoomStart !== null && zoomEnd !== null;

  // 統計計算
  const spreads = rows
    .map((r) => r.maxSpreadPct)
    .filter((v): v is number => v !== null);
  const stats = {
    max: spreads.length > 0 ? Math.max(...spreads) : 0,
    min: spreads.length > 0 ? Math.min(...spreads) : 0,
    avg:
      spreads.length > 0
        ? spreads.reduce((a, b) => a + b, 0) / spreads.length
        : 0,
    count: rows.length,
  };

  // Y軸範囲（表示中のデータ + 表示中のラインのみで計算）
  const yMax = useMemo(() => {
    const vals: number[] = [];
    for (const d of zoomedData) {
      if (visibleLines.mxBg && d.mxBg != null) vals.push(Math.abs(d.mxBg));
      if (visibleLines.mxCx && d.mxCx != null) vals.push(Math.abs(d.mxCx));
      if (visibleLines.bgCx && d.bgCx != null) vals.push(Math.abs(d.bgCx));
    }
    return vals.length > 0 ? Math.max(...vals) * 1.1 : 1;
  }, [zoomedData, visibleLines]);

  // 現在値
  const latest = rows[rows.length - 1];

  const toggleLine = useCallback((key: LineKey) => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomStart(null);
    setZoomEnd(null);
  }, []);

  const navigateTo = useCallback(
    (sym: string) => {
      resetZoom();
      router.push(`/symbol/${encodeURIComponent(sym)}`);
    },
    [router, resetZoom]
  );

  // キーボード ← → で前後切替
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowLeft" && prevSymbol) {
        e.preventDefault();
        navigateTo(prevSymbol);
      } else if (e.key === "ArrowRight" && nextSymbol) {
        e.preventDefault();
        navigateTo(nextSymbol);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevSymbol, nextSymbol, navigateTo]);

  const handlePeriodChange = useCallback(
    (hours: number) => {
      setPeriod(hours);
      resetZoom();
    },
    [resetZoom]
  );

  // マウスホイールでズーム（native listener for passive: false）
  const handleWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  handleWheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const total = chartData.length;
    if (total < MIN_VISIBLE_POINTS) return;

    const curStart = zoomStart ?? 0;
    const curEnd = zoomEnd ?? total - 1;
    const range = curEnd - curStart;

    const container = chartContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (e.deltaY < 0) {
      const shrink = Math.max(1, Math.round(range * ZOOM_FACTOR));
      const leftShrink = Math.round(shrink * ratio);
      const rightShrink = shrink - leftShrink;
      const newStart = Math.min(curStart + leftShrink, curEnd - MIN_VISIBLE_POINTS + 1);
      const newEnd = Math.max(curEnd - rightShrink, newStart + MIN_VISIBLE_POINTS - 1);
      setZoomStart(Math.max(0, newStart));
      setZoomEnd(Math.min(total - 1, newEnd));
    } else {
      const grow = Math.max(1, Math.round(range * ZOOM_FACTOR));
      const leftGrow = Math.round(grow * ratio);
      const rightGrow = grow - leftGrow;
      const newStart = Math.max(0, curStart - leftGrow);
      const newEnd = Math.min(total - 1, curEnd + rightGrow);
      if (newStart === 0 && newEnd === total - 1) {
        setZoomStart(null);
        setZoomEnd(null);
      } else {
        setZoomStart(newStart);
        setZoomEnd(newEnd);
      }
    }
  };

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => handleWheelRef.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // パン（ドラッグでスクロール）
  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      if (!isZoomed) return;
      setIsPanning(true);
      panStartX.current = e.clientX;
      panStartRange.current = [zoomStart!, zoomEnd!];
    },
    [isZoomed, zoomStart, zoomEnd]
  );

  const handlePanMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const container = chartContainerRef.current;
      if (!container) return;

      const dx = e.clientX - panStartX.current;
      const containerWidth = container.getBoundingClientRect().width;
      const [origStart, origEnd] = panStartRange.current;
      const range = origEnd - origStart;
      const shift = Math.round((-dx / containerWidth) * range);

      let newStart = origStart + shift;
      let newEnd = origEnd + shift;

      // 端のクランプ
      if (newStart < 0) {
        newStart = 0;
        newEnd = range;
      }
      if (newEnd >= chartData.length) {
        newEnd = chartData.length - 1;
        newStart = newEnd - range;
      }

      setZoomStart(Math.max(0, newStart));
      setZoomEnd(Math.min(chartData.length - 1, newEnd));
    },
    [isPanning, chartData.length]
  );

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ズーム率表示
  const zoomPercent = isZoomed
    ? Math.round(((zoomEnd! - zoomStart! + 1) / chartData.length) * 100)
    : 100;

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            ← 戻る
          </Link>
          <h1 className="text-lg sm:text-xl font-bold">{symbol}</h1>
          {currentIdx >= 0 && (
            <span className="text-xs text-gray-500 font-mono">
              {currentIdx + 1}/{symbolList.length}
            </span>
          )}
        </div>
        {symbolList.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => prevSymbol && navigateTo(prevSymbol)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
              title="前の銘柄 (←)"
            >
              ◀
            </button>
            <button
              onClick={() => nextSymbol && navigateTo(nextSymbol)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
              title="次の銘柄 (→)"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* 現在の差率 */}
      {latest && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500">MX-BG</div>
            <div className="text-base sm:text-lg font-bold text-blue-400 font-mono">
              {latest.mxBgPct?.toFixed(4) ?? "-"}%
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500">MX-CX</div>
            <div className="text-base sm:text-lg font-bold text-red-400 font-mono">
              {latest.mxCxPct?.toFixed(4) ?? "-"}%
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500">BG-CX</div>
            <div className="text-base sm:text-lg font-bold text-green-400 font-mono">
              {latest.bgCxPct?.toFixed(4) ?? "-"}%
            </div>
          </div>
        </div>
      )}

      {/* 統計 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {[
          { label: "最大", value: stats.max.toFixed(4) + "%" },
          { label: "最小", value: stats.min.toFixed(4) + "%" },
          { label: "平均", value: stats.avg.toFixed(4) + "%" },
          { label: "データ数", value: stats.count.toString() },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-gray-900 border border-gray-800 rounded-lg p-3"
          >
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="text-sm font-bold font-mono">{s.value}</div>
          </div>
        ))}
      </div>

      {/* 期間切り替え */}
      <div className="flex gap-1 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.hours}
            onClick={() => handlePeriodChange(p.hours)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              period === p.hours
                ? "bg-blue-500/20 text-blue-400"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* チャート */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 sm:p-4">
        {/* ライントグル + ズームリセット */}
        <div className="flex flex-wrap items-center justify-between mb-2">
          <div className="flex gap-2">
            {LINE_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => toggleLine(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  visibleLines[key]
                    ? "bg-gray-800 text-gray-200"
                    : "bg-gray-800/40 text-gray-600 line-through"
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: COLORS[key],
                    opacity: visibleLines[key] ? 1 : 0.3,
                  }}
                />
                {LINE_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {isZoomed && (
              <>
                <span className="text-xs text-gray-500 font-mono">
                  {zoomPercent}%
                </span>
                <button
                  onClick={resetZoom}
                  className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  リセット
                </button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="h-80 flex items-center justify-center text-gray-500">
            読み込み中...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500">
            データなし
          </div>
        ) : (
          <div
            ref={chartContainerRef}
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onDoubleClick={resetZoom}
            className="select-none"
            style={{ cursor: isZoomed ? (isPanning ? "grabbing" : "grab") : "crosshair" }}
          >
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={zoomedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[-yMax, yMax]}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  tickFormatter={(v: number) => `${v.toFixed(2)}%`}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#e5e7eb",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value?.toFixed(4)}%`,
                    LINE_LABELS[name as LineKey] ?? name,
                  ]}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                <ReferenceLine
                  y={0.5}
                  stroke="#f97316"
                  strokeDasharray="2 4"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  y={-0.5}
                  stroke="#f97316"
                  strokeDasharray="2 4"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  y={1.0}
                  stroke="#ef4444"
                  strokeDasharray="2 4"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  y={-1.0}
                  stroke="#ef4444"
                  strokeDasharray="2 4"
                  strokeOpacity={0.5}
                />
                {visibleLines.mxBg && (
                  <Line
                    type="monotone"
                    dataKey="mxBg"
                    stroke={COLORS.mxBg}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}
                {visibleLines.mxCx && (
                  <Line
                    type="monotone"
                    dataKey="mxCx"
                    stroke={COLORS.mxCx}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}
                {visibleLines.bgCx && (
                  <Line
                    type="monotone"
                    dataKey="bgCx"
                    stroke={COLORS.bgCx}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
          ホイール: ズーム｜ドラッグ: パン｜ダブルクリック: リセット
        </div>
      </div>
    </div>
  );
}
