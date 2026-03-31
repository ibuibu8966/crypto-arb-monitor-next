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
  { label: "4h", hours: 4 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "1W", hours: 168 },
  { label: "1M", hours: 720 },
  { label: "1Y", hours: 8760 },
];

type LineKey = "mxBg" | "mxCx" | "bgCx";
type PriceKey = "mexc" | "bitget" | "coinex";

// 取引所ブランドカラー（固定）
const EXCHANGE_COLORS: Record<PriceKey, string> = {
  mexc:   "#06b6d4", // シアン
  bitget: "#f59e0b", // オレンジ
  coinex: "#ec4899", // ピンク
};

// ペアの色 = 2取引所のブレンド
const LINE_CONFIG: { key: LineKey; label: string; color: string; exchanges: PriceKey[] }[] = [
  { key: "mxBg", label: "MX-BG", color: "#84cc16", exchanges: ["mexc", "bitget"] },   // ライム（シアン+オレンジ）
  { key: "mxCx", label: "MX-CX", color: "#a78bfa", exchanges: ["mexc", "coinex"] },   // パープル（シアン+ピンク）
  { key: "bgCx", label: "BG-CX", color: "#f87171", exchanges: ["bitget", "coinex"] }, // コーラル（オレンジ+ピンク）
];

const PRICE_CONFIG: { key: PriceKey; label: string; color: string }[] = [
  { key: "mexc",   label: "MEXC",   color: EXCHANGE_COLORS.mexc },
  { key: "bitget", label: "Bitget", color: EXCHANGE_COLORS.bitget },
  { key: "coinex", label: "CoinEX", color: EXCHANGE_COLORS.coinex },
];

/** シンボル名から各取引所のURLを生成 */
function getExchangeUrl(exchange: PriceKey, symbol: string): string {
  // "MON/USDT:USDT" → base="MON", quote="USDT"
  const [pair] = symbol.split(":");
  const [base, quote] = pair.split("/");
  switch (exchange) {
    case "mexc":
      return `https://www.mexc.com/ja-JP/futures/${base}_${quote}`;
    case "bitget":
      return `https://www.bitget.com/ja/spot/${base}${quote}`;
    case "coinex":
      return `https://www.coinex.com/ja/exchange/${base}-${quote}`;
  }
}

const MIN_VISIBLE_POINTS = 10;
const ZOOM_FACTOR = 0.15;

function countCrossingsNullable(
  data: { v: number | null }[],
  line: number
): number {
  let count = 0;
  let prev: number | null = null;
  for (const d of data) {
    if (d.v != null) {
      if (prev != null && prev < line && d.v >= line) count++;
      prev = d.v;
    }
  }
  return count;
}

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
  const [selectedPair, setSelectedPair] = useState<LineKey | "all">("all");

  // ズーム状態（インデックスベース）
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);

  // パン用
  const [isPanning, setIsPanning] = useState(false);
  const panStartX = useRef<number>(0);
  const panStartRange = useRef<[number, number]>([0, 0]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const priceChartContainerRef = useRef<HTMLDivElement>(null);

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
        mexc: r.mexc,
        bitget: r.bitget,
        coinex: r.coinex,
      })),
    [rows]
  );

  // ズーム範囲のデータ
  const zoomedData = useMemo(() => {
    if (zoomStart === null || zoomEnd === null) return chartData;
    return chartData.slice(zoomStart, zoomEnd + 1);
  }, [chartData, zoomStart, zoomEnd]);

  const isZoomed = zoomStart !== null && zoomEnd !== null;

  // 現在値
  const latest = rows[rows.length - 1];

  // 最大乖離ペアの算出
  const maxPair = useMemo((): LineKey => {
    if (!latest) return "mxBg";
    const abs = {
      mxBg: Math.abs(latest.mxBgPct ?? 0),
      mxCx: Math.abs(latest.mxCxPct ?? 0),
      bgCx: Math.abs(latest.bgCxPct ?? 0),
    };
    if (abs.mxBg >= abs.mxCx && abs.mxBg >= abs.bgCx) return "mxBg";
    if (abs.mxCx >= abs.bgCx) return "mxCx";
    return "bgCx";
  }, [latest]);

  // 表示するラインキー
  const activeLines = useMemo((): LineKey[] => {
    if (selectedPair === "all") return LINE_CONFIG.map((c) => c.key);
    return [selectedPair];
  }, [selectedPair]);

  // 表示する取引所
  const activePrices = useMemo((): PriceKey[] => {
    if (selectedPair === "all") return PRICE_CONFIG.map((c) => c.key);
    return LINE_CONFIG.find((c) => c.key === selectedPair)!.exchanges;
  }, [selectedPair]);

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

  // 各ラインごとの20%/80%バンド算出（統合チャート）
  const lineBands = useMemo(() => {
    const result: Record<
      LineKey,
      { line20: number; line80: number; cross20: number; cross80: number; min: number; max: number }
    > = {} as never;

    for (const cfg of LINE_CONFIG) {
      const values = chartData
        .map((d) => d[cfg.key])
        .filter((v): v is number => v != null);
      if (values.length === 0) {
        result[cfg.key] = { line20: 0, line80: 0, cross20: 0, cross80: 0, min: 0, max: 0 };
        continue;
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      const l20 = min + range * 0.2;
      const l80 = min + range * 0.8;
      const mapped = chartData.map((d) => ({ v: d[cfg.key] }));
      result[cfg.key] = {
        line20: l20,
        line80: l80,
        cross20: countCrossingsNullable(mapped, l20),
        cross80: countCrossingsNullable(mapped, l80),
        min,
        max,
      };
    }
    return result;
  }, [chartData]);

  // Y軸範囲 + 5値ticks（統合チャート）
  const { yDomain, yTicks } = useMemo(() => {
    if (zoomedData.length === 0)
      return { yDomain: [-1, 1] as [number, number], yTicks: [0] };

    const allVals: number[] = [];
    for (const key of activeLines) {
      for (const d of zoomedData) {
        const v = d[key];
        if (v != null) allVals.push(v);
      }
    }
    if (allVals.length === 0)
      return { yDomain: [-1, 1] as [number, number], yTicks: [0] };

    const absMax = Math.max(...allVals.map(Math.abs)) * 1.1;
    const domain: [number, number] = [-absMax, absMax];

    const tickSet = new Set<number>([0]);
    for (const key of activeLines) {
      const b = lineBands[key];
      tickSet.add(b.max);
      tickSet.add(b.line80);
      tickSet.add(b.line20);
      tickSet.add(b.min);
    }
    const ticks = [...tickSet].sort((a, b) => a - b);

    return { yDomain: domain, yTicks: ticks };
  }, [zoomedData, activeLines, lineBands]);

  // Y軸範囲（個別チャート — 価格）
  const { priceDomain } = useMemo(() => {
    if (zoomedData.length === 0)
      return { priceDomain: [0, 1] as [number, number] };

    const allVals: number[] = [];
    for (const key of activePrices) {
      for (const d of zoomedData) {
        const v = d[key];
        if (v != null) allVals.push(v);
      }
    }
    if (allVals.length === 0)
      return { priceDomain: [0, 1] as [number, number] };

    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const margin = (max - min) * 0.05 || 0.001;
    return { priceDomain: [min - margin, max + margin] as [number, number] };
  }, [zoomedData, activePrices]);

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

    const container = chartContainerRef.current?.contains(e.target as Node)
      ? chartContainerRef.current
      : priceChartContainerRef.current?.contains(e.target as Node)
        ? priceChartContainerRef.current
        : chartContainerRef.current;
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
    const handler = (e: WheelEvent) => handleWheelRef.current(e);
    const el1 = chartContainerRef.current;
    const el2 = priceChartContainerRef.current;
    if (el1) el1.addEventListener("wheel", handler, { passive: false });
    if (el2) el2.addEventListener("wheel", handler, { passive: false });
    return () => {
      if (el1) el1.removeEventListener("wheel", handler);
      if (el2) el2.removeEventListener("wheel", handler);
    };
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
      const container = chartContainerRef.current ?? priceChartContainerRef.current;
      if (!container) return;

      const dx = e.clientX - panStartX.current;
      const containerWidth = container.getBoundingClientRect().width;
      const [origStart, origEnd] = panStartRange.current;
      const range = origEnd - origStart;
      const shift = Math.round((-dx / containerWidth) * range);

      let newStart = origStart + shift;
      let newEnd = origEnd + shift;

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

  // 共通のチャートインタラクションprops
  const chartInteractionProps = {
    onMouseDown: handlePanStart,
    onMouseMove: handlePanMove,
    onMouseUp: handlePanEnd,
    onMouseLeave: handlePanEnd,
    onDoubleClick: resetZoom,
    className: "select-none",
    style: { cursor: isZoomed ? (isPanning ? "grabbing" : "grab") : "crosshair" } as React.CSSProperties,
  };

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
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
              title="前の銘柄 (←)"
            >
              ◀
            </button>
            <button
              onClick={() => nextSymbol && navigateTo(nextSymbol)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
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
          {LINE_CONFIG.map((cfg) => {
            const val = latest[`${cfg.key}Pct` as keyof typeof latest] as number | null;
            return (
              <div key={cfg.key} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: EXCHANGE_COLORS[cfg.exchanges[0]] }} />
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: EXCHANGE_COLORS[cfg.exchanges[1]] }} />
                  {cfg.label}
                </div>
                <div className="text-base sm:text-lg font-bold font-mono" style={{ color: cfg.color }}>
                  {val?.toFixed(4) ?? "-"}%
                </div>
              </div>
            );
          })}
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

      {/* 期間切り替え + ズームリセット */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.hours}
              onClick={() => handlePeriodChange(p.hours)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                period === p.hours
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {isZoomed && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">
              {zoomPercent}%
            </span>
            <button
              onClick={resetZoom}
              className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
            >
              リセット
            </button>
          </div>
        )}
      </div>

      {/* 統合チャート */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 sm:p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400">統合チャート</span>
            <span className="text-gray-700">|</span>
            <button
              onClick={() => setSelectedPair(maxPair)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                selectedPair !== "all" && selectedPair === maxPair
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-gray-800/40 text-gray-500 hover:text-gray-300"
              }`}
            >
              最大乖離
            </button>
            <button
              onClick={() => setSelectedPair("all")}
              className={`px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                selectedPair === "all"
                  ? "bg-white/10 text-white"
                  : "bg-gray-800/40 text-gray-600"
              }`}
            >
              全表示
            </button>
            {LINE_CONFIG.map((cfg) => {
              const active = selectedPair === cfg.key;
              const b = lineBands[cfg.key];
              return (
                <button
                  key={cfg.key}
                  onClick={() => setSelectedPair(active ? "all" : cfg.key)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                    active || selectedPair === "all"
                      ? "text-white"
                      : "bg-gray-800/40 text-gray-600"
                  }`}
                  style={
                    active || selectedPair === "all"
                      ? { backgroundColor: cfg.color + "33", color: cfg.color }
                      : {}
                  }
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-0.5" style={{ backgroundColor: EXCHANGE_COLORS[cfg.exchanges[0]] }} />
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: EXCHANGE_COLORS[cfg.exchanges[1]] }} />
                  {cfg.label}
                  {(active || selectedPair === "all") && chartData.length > 0 && (
                    <span className="ml-1 font-normal opacity-70">
                      ↑80%:{b.cross80} ↑20%:{b.cross20}
                    </span>
                  )}
                </button>
              );
            })}
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
          <div ref={chartContainerRef} {...chartInteractionProps}>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={zoomedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
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
                  formatter={(value: number, name: string) => {
                    const cfg = LINE_CONFIG.find((c) => c.key === name);
                    return [`${value?.toFixed(4)}%`, cfg?.label ?? name];
                  }}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                {LINE_CONFIG.map((cfg) =>
                  activeLines.includes(cfg.key) ? (
                    <Line
                      key={cfg.key}
                      type="monotone"
                      dataKey={cfg.key}
                      stroke={cfg.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ) : null
                )}
                {LINE_CONFIG.map((cfg) => {
                  if (!activeLines.includes(cfg.key)) return null;
                  const b = lineBands[cfg.key];
                  return [
                    <ReferenceLine
                      key={`${cfg.key}-80`}
                      y={b.line80}
                      stroke={cfg.color}
                      strokeDasharray="4 2"
                      strokeOpacity={0.4}
                      strokeWidth={1}
                    />,
                    <ReferenceLine
                      key={`${cfg.key}-20`}
                      y={b.line20}
                      stroke={cfg.color}
                      strokeDasharray="4 2"
                      strokeOpacity={0.4}
                      strokeWidth={1}
                    />,
                  ];
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex justify-center mt-2 text-xs text-gray-500">
          ホイール: ズーム｜ドラッグ: パン｜ダブルクリック: リセット
        </div>
      </div>

      {/* 個別チャート */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-bold text-gray-400">個別チャート</span>
          <span className="text-gray-700">|</span>
          {PRICE_CONFIG.map((cfg) => {
            const active = activePrices.includes(cfg.key);
            return (
              <a
                key={cfg.key}
                href={getExchangeUrl(cfg.key, symbol)}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                  active ? "text-white" : "bg-gray-800/20 text-gray-700"
                }`}
                style={active ? { backgroundColor: cfg.color + "33", color: cfg.color } : {}}
              >
                {cfg.label}
              </a>
            );
          })}
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
          <div ref={priceChartContainerRef} {...chartInteractionProps}>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={zoomedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={priceDomain}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  tickFormatter={(v: number) => v.toPrecision(6)}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#e5e7eb",
                  }}
                  formatter={(value: number, name: string) => {
                    const cfg = PRICE_CONFIG.find((c) => c.key === name);
                    return [value?.toPrecision(8), cfg?.label ?? name];
                  }}
                />
                {PRICE_CONFIG.map((cfg) =>
                  activePrices.includes(cfg.key) ? (
                    <Line
                      key={cfg.key}
                      type="monotone"
                      dataKey={cfg.key}
                      stroke={cfg.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex justify-center mt-2 text-xs text-gray-500">
          ホイール: ズーム｜ドラッグ: パン｜ダブルクリック: リセット
        </div>
      </div>
    </div>
  );
}
