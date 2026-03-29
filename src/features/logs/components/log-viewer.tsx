"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import type { SpreadTickDTO } from "@/types";

type LogsResponse = { rows: SpreadTickDTO[]; total: number };

const PAGE_SIZES = [50, 100, 500] as const;

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmt(v: number | null) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(4);
}

function fmtPct(v: number | null) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(4);
}

export function LogViewer() {
  const [limit, setLimit] = useState<number>(50);
  const [page, setPage] = useState(0);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [inputValue, setInputValue] = useState("");

  const offset = page * limit;

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ["logs", limit, offset, symbolFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        hours: "24",
      });
      if (symbolFilter) params.set("symbol", symbolFilter);
      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) throw new Error("API error");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleSearch = useCallback(() => {
    setSymbolFilter(inputValue.trim());
    setPage(0);
  }, [inputValue]);

  const downloadCsv = useCallback(() => {
    if (!rows.length) return;
    const headers = [
      "timestamp",
      "symbol",
      "mexc",
      "bitget",
      "coinex",
      "mx_bg_pct",
      "mx_cx_pct",
      "bg_cx_pct",
      "max_spread_pct",
    ];
    const csvRows = rows.map((r) =>
      [
        r.timestamp,
        r.symbol,
        r.mexc ?? "",
        r.bitget ?? "",
        r.coinex ?? "",
        r.mxBgPct ?? "",
        r.mxCxPct ?? "",
        r.bgCxPct ?? "",
        r.maxSpreadPct ?? "",
      ].join(",")
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spread_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <div>
      <p className="text-sm text-gray-400 mb-4">
        直近24h（{total.toLocaleString()}件）
      </p>

      {/* フィルター */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="BTC, ETH, SOL..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 w-48 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg cursor-pointer"
          >
            検索
          </button>
          {symbolFilter && (
            <button
              onClick={() => {
                setInputValue("");
                setSymbolFilter("");
                setPage(0);
              }}
              className="text-gray-400 hover:text-gray-200 text-sm cursor-pointer"
            >
              クリア
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">表示件数:</label>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(0);
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-200 cursor-pointer"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={downloadCsv}
          className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg cursor-pointer"
        >
          CSV ダウンロード
        </button>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-gray-400 text-left">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">timestamp</th>
              <th className="px-3 py-2 font-medium">symbol</th>
              <th className="px-3 py-2 font-medium text-right">mexc</th>
              <th className="px-3 py-2 font-medium text-right">bitget</th>
              <th className="px-3 py-2 font-medium text-right">coinex</th>
              <th className="px-3 py-2 font-medium text-right">mx_bg_pct</th>
              <th className="px-3 py-2 font-medium text-right">mx_cx_pct</th>
              <th className="px-3 py-2 font-medium text-right">bg_cx_pct</th>
              <th className="px-3 py-2 font-medium text-right">
                max_spread_pct
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  読み込み中...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  データなし
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="px-3 py-1.5 text-gray-500">
                    {offset + i + 1}
                  </td>
                  <td className="px-3 py-1.5 text-gray-300 whitespace-nowrap">
                    {formatTs(r.timestamp)}
                  </td>
                  <td className="px-3 py-1.5 text-gray-200 font-mono">
                    {r.symbol}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {fmt(r.mexc)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {fmt(r.bitget)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {fmt(r.coinex)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {fmtPct(r.mxBgPct)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {fmtPct(r.mxCxPct)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {fmtPct(r.bgCxPct)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold text-yellow-400">
                    {fmtPct(r.maxSpreadPct)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
        <span>
          {total > 0
            ? `${offset + 1}〜${Math.min(offset + limit, total)} / ${total.toLocaleString()}件`
            : "0件"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-default cursor-pointer"
          >
            前へ
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-default cursor-pointer"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
