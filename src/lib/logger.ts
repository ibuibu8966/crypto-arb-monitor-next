import * as Sentry from "@sentry/nextjs";

/** サーバーサイド用ロガー — Sentry + コンソール出力（Renderログ用） */
export function captureError(label: string, error: unknown) {
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, { tags: { label } });
  }
  // eslint-disable-next-line no-console
  console.error(`[${label}]`, error instanceof Error ? error.message : error);
}
