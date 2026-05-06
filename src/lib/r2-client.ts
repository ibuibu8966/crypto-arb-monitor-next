/**
 * Cloudflare R2 (S3互換) クライアント。
 * 日次 Parquet ファイル (spread_log/YYYY/MM/DD.parquet) を取得し、
 * メモリLRUにキャッシュする。
 *
 * このファイルは server side でのみ使用すること（認証情報が含まれるため）。
 */
import { S3Client, GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET_NAME || "crypto-arb-archive";
const ENDPOINT = process.env.R2_ENDPOINT_URL || (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
const READ_ENABLED = (process.env.R2_READ_ENABLED || "false").toLowerCase() === "true";

let _client: S3Client | null = null;

export function isR2ReadEnabled(): boolean {
  return READ_ENABLED && Boolean(ACCESS_KEY_ID) && Boolean(SECRET_ACCESS_KEY);
}

function getClient(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function keyForSymbolUTCDate(symbol: string, date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  const safe = encodeURIComponent(symbol);
  return `spread_log/${safe}/${y}/${m}/${d}.parquet`;
}

/** メモリLRUキャッシュ（最大10日、24h TTL） */
type CacheEntry = { bytes: Uint8Array; expires: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 10;

function cacheGet(key: string): Uint8Array | null {
  const e = cache.get(key);
  if (!e) return null;
  if (e.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, e);
  return e.bytes;
}

function cacheSet(key: string, bytes: Uint8Array) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { bytes, expires: Date.now() + CACHE_TTL_MS });
}

/**
 * 指定銘柄×UTC日のParquetをR2から取得。存在しなければ null。
 * メモリLRUにキャッシュ。symbol-partitioned 設計により1ファイルが軽量。
 */
export async function fetchSymbolDayParquet(symbol: string, date: Date): Promise<Uint8Array | null> {
  const key = keyForSymbolUTCDate(symbol, date);
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const res = await getClient().send(cmd);
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    cacheSet(key, bytes);
    return bytes;
  } catch (e) {
    if (e instanceof NoSuchKey) return null;
    if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}
