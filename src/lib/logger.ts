import * as Sentry from "@sentry/nextjs";

/** サーバーサイド用ロガー — Sentry DSN未設定時はno-op */
export function captureError(label: string, error: unknown) {
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, { tags: { label } });
  }
  // 開発環境のみコンソール出力
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.error(`[${label}]`, error);
  }
}
