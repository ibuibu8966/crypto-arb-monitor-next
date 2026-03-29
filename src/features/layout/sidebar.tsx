"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { StatsDTO } from "@/types";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/charts", label: "全銘柄チャート", icon: "📈" },
  { href: "/logs", label: "ログ", icon: "📋" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isSymbolPage = pathname.startsWith("/symbol");

  const { data: stats } = useQuery<StatsDTO[]>({
    queryKey: ["stats", 24],
    queryFn: async () => {
      const res = await fetch("/api/stats?hours=24");
      if (!res.ok) throw new Error("API error");
      return res.json();
    },
    staleTime: 60_000,
  });

  const symbols = stats?.map((s) => s.symbol) ?? [];
  const filtered = search
    ? symbols.filter((s) => s.toLowerCase().includes(search.toLowerCase()))
    : symbols;

  return (
    <>
      {/* モバイルハンバーガー */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-3 left-3 z-50 bg-gray-900 border border-gray-700 rounded-lg p-2 text-gray-300"
      >
        {open ? "✕" : "☰"}
      </button>

      {/* オーバーレイ（モバイル） */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-56 bg-gray-900 border-r border-gray-800 z-40
          transition-transform duration-200 flex flex-col
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xs font-bold text-gray-100">MEXC x Bitget x CoinEX</h1>
          <p className="text-xs text-gray-500 mt-0.5">先物価格差モニター</p>
        </div>

        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                  transition-colors cursor-pointer
                  ${
                    active
                      ? "bg-blue-500/10 text-blue-400 font-medium"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          {/* 時系列チャート（銘柄一覧） */}
          <button
            onClick={() => setSymbolOpen(!symbolOpen)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-left
              transition-colors cursor-pointer
              ${
                isSymbolPage
                  ? "bg-blue-500/10 text-blue-400 font-medium"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }
            `}
          >
            <span className="text-base">📉</span>
            時系列チャート
            <span className="ml-auto text-xs">{symbolOpen ? "▼" : "▶"}</span>
          </button>
        </nav>

        {/* 銘柄リスト（展開時） */}
        {symbolOpen && (
          <div className="flex-1 overflow-hidden flex flex-col border-t border-gray-800">
            <div className="p-2">
              <input
                type="text"
                placeholder="銘柄検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-600 px-2 py-1">該当なし</p>
              ) : (
                filtered.map((sym, i) => {
                  const href = `/symbol/${sym}`;
                  const active = decodeURIComponent(pathname) === `/symbol/${sym}`;
                  return (
                    <Link
                      key={sym}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`
                        block px-2 py-1 rounded text-xs truncate cursor-pointer
                        ${
                          active
                            ? "bg-blue-500/10 text-blue-400"
                            : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                        }
                      `}
                    >
                      <span className="text-gray-600 mr-1">{i + 1}.</span>
                      {sym}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
