/**
 * R2 (Cloudflare) 上の Parquet アーカイブから過去の spread_log を取得する。
 * fetchDayParquet で日次 Parquet を取得 → hyparquet で symbol フィルタ済みの行を返す。
 *
 * このファイルは server side でのみ使用すること。
 */
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { fetchDayParquet } from "@/lib/r2-client";

type ArchiveRow = {
  id: number;
  symbol: string;
  timestamp: string;
  mexc: number | null;
  bitget: number | null;
  coinex: number | null;
  mx_bg_pct: number | null;
  mx_cx_pct: number | null;
  bg_cx_pct: number | null;
  max_spread_pct: number | null;
};

const FETCH_CONCURRENCY = 3;

/** from と to の間のUTC日付を昇順で列挙（両端含む） */
function utcDateRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

async function readParquetForSymbol(bytes: Uint8Array, symbol: string): Promise<ArchiveRow[]> {
  const file = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const rows = await parquetReadObjects({ file, compressors });
  const filtered: ArchiveRow[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    if (r.symbol !== symbol) continue;
    const ts = r.timestamp;
    let timestamp: string;
    if (ts instanceof Date) timestamp = ts.toISOString();
    else if (typeof ts === "string") timestamp = ts;
    else if (typeof ts === "bigint") timestamp = new Date(Number(ts) / 1000).toISOString();
    else if (typeof ts === "number") timestamp = new Date(ts).toISOString();
    else continue;

    filtered.push({
      id: Number(r.id ?? 0),
      symbol: String(r.symbol),
      timestamp,
      mexc: r.mexc as number | null,
      bitget: r.bitget as number | null,
      coinex: r.coinex as number | null,
      mx_bg_pct: r.mx_bg_pct as number | null,
      mx_cx_pct: r.mx_cx_pct as number | null,
      bg_cx_pct: r.bg_cx_pct as number | null,
      max_spread_pct: r.max_spread_pct as number | null,
    });
  }
  return filtered;
}

/** 並列度制限つき map */
async function mapWithConcurrency<T, U>(items: T[], limit: number, fn: (x: T) => Promise<U>): Promise<U[]> {
  const out: U[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * R2 上のアーカイブから期間内の指定銘柄のticksを取得。
 * from と to は UTC タイムスタンプ。両端の日のParquetを読みつつ、from <= timestamp < to で絞る。
 */
export async function findHistoryFromArchive(
  symbol: string,
  from: Date,
  to: Date
): Promise<ArchiveRow[]> {
  const dates = utcDateRange(from, to);

  const perDay = await mapWithConcurrency(dates, FETCH_CONCURRENCY, async (d) => {
    const bytes = await fetchDayParquet(d);
    if (!bytes) return [];
    try {
      return await readParquetForSymbol(bytes, symbol);
    } catch {
      return [];
    }
  });

  const merged = perDay.flat().filter((r) => {
    const t = new Date(r.timestamp).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return merged;
}
