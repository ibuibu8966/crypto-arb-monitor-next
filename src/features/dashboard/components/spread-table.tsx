"use client";

import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import type { RealtimeRow } from "@/types";

type Props = {
  data: RealtimeRow[];
  onSymbolClick: (symbol: string) => void;
};

type SortKey = "symbol" | "maxSpreadPct" | "mxBgPct" | "mxCxPct" | "bgCxPct";

function pctCell(val: number | null) {
  if (val === null) return <span className="text-gray-600">-</span>;
  const abs = Math.abs(val);
  const color =
    abs >= 0.1
      ? "text-red-400"
      : abs >= 0.05
        ? "text-orange-400"
        : "text-green-400";
  return <span className={color}>{val.toFixed(4)}%</span>;
}

function priceCell(val: number | null) {
  if (val === null) return <span className="text-gray-600">-</span>;
  return <span className="text-gray-300">{val.toFixed(4)}</span>;
}

export function SpreadTable({ data, onSymbolClick }: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [sortKey, setSortKey] = useState<SortKey>("maxSpreadPct");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let rows = data;
    if (debouncedSearch) {
      const q = debouncedSearch.toUpperCase();
      rows = rows.filter((r) => r.symbol.toUpperCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (typeof av === "string" && typeof bv === "string")
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return rows;
  }, [data, debouncedSearch, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <input
          type="text"
          placeholder="銘柄検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 text-gray-200 px-3 py-2 rounded-md text-sm w-full md:w-64 outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="px-3 py-2 text-left">状態</th>
              <th
                className="px-3 py-2 text-left cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("symbol")}
              >
                銘柄{sortIcon("symbol")}
              </th>
              <th className="px-3 py-2 text-right">MEXC</th>
              <th className="px-3 py-2 text-right">Bitget</th>
              <th className="px-3 py-2 text-right">CoinEX</th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("mxBgPct")}
              >
                MX-BG{sortIcon("mxBgPct")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("mxCxPct")}
              >
                MX-CX{sortIcon("mxCxPct")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("bgCxPct")}
              >
                BG-CX{sortIcon("bgCxPct")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("maxSpreadPct")}
              >
                最大差率{sortIcon("maxSpreadPct")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const abs = Math.abs(r.maxSpreadPct ?? 0);
              const status =
                abs >= 0.1
                  ? "bg-red-500"
                  : abs >= 0.05
                    ? "bg-orange-500"
                    : "bg-green-500";
              return (
                <tr
                  key={r.symbol}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => onSymbolClick(r.symbol)}
                >
                  <td className="px-3 py-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${status}`} />
                  </td>
                  <td className="px-3 py-2 font-mono font-bold text-gray-200">
                    {r.symbol}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {priceCell(r.mexc)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {priceCell(r.bitget)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {priceCell(r.coinex)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {pctCell(r.mxBgPct)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {pctCell(r.mxCxPct)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {pctCell(r.bgCxPct)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold">
                    {pctCell(r.maxSpreadPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-800">
        {filtered.length} / {data.length} 銘柄
      </div>
    </div>
  );
}
