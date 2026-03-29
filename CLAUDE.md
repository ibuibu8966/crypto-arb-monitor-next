# crypto-arb-monitor-next

## プロジェクト概要
MEXC・Bitget・CoinEXの3取引所間の先物（Perpetual Swap）価格差をリアルタイム監視するダッシュボード。Python/Streamlit版からNext.jsへリプレイス。認証なし（利用者2名のみ）。

---

## 技術スタック
| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js (App Router) + TypeScript (strict) |
| ホスティング | Vercel |
| DB | PostgreSQL (Render) — 既存テーブルを継続利用 |
| ORM | Prisma |
| データ収集 | 既存の Python `collector.py` (Render Worker) — **このプロジェクトでは触らない** |
| チャート | Recharts |
| UI | shadcn/ui + Tailwind CSS |
| 状態管理 | TanStack Query |
| フォーム | react-hook-form + zod |
| リント | ESLint + Prettier |

---

## 開発ルール（10箇条）

### 1. アーキテクチャ — クリーンアーキテクチャで責任分離
- ディレクトリ構成: `features/xxx/`（ページ側UI）、`app/api/xxx/`（API側）、`controllers/`、`use-cases/`、`repositories/`
- `page.tsx` は Server Component。`"use client"` を書かない
- `route.ts` は10行以下。controller に渡すだけ
- controller = zod バリデーション + use-case 呼び出し + レスポンス整形
- repository = Prisma 操作のみ。ビジネスロジック・計算を入れない
- 複数DB操作は必ず `prisma.$transaction()` で包む
- `docs/api-docs.md` と `docs/db-dictionary.md` を常に最新に保つ（AIが参照する前提）
- Server Component と Client Component は明確に分離する

### 2. データ取得 — HydrationBoundary で初回即表示
- 初回表示は `HydrationBoundary`（prefetchQuery → dehydrate）で SSR データを渡す
- 詳細ページはホバー / タッチで `prefetchQuery` を発火してプリフェッチ
- 重い部分は `Suspense` + スケルトンで段階的に表示

### 3. キャッシュ戦略
- デフォルト設定: `staleTime: 5分` / `gcTime: 30分`
- CRUD 操作後は楽観的更新（Optimistic Update）を必ず実装する

### 4. クエリ最適化
- N+1 問題を絶対に防ぐ。`include` / `join` で一括取得する
- 必要なカラムだけ `select` する。`select *` 相当の全カラム取得は禁止
- 全件取得禁止。必ずページネーション（cursor or offset）を実装する
- 検索・フィルター対象カラムにはインデックスを貼る
- 重い集計・計算は事前計算テーブル + Cron で処理する

### 5. 型安全
- `any` 型は絶対に使用禁止。`unknown` + 型ガードで対処する
- 外部データ（API レスポンス、フォーム入力、URL パラメータ）は全て zod でバリデーション
- Prisma の型を直接 UI に渡さない。必ず DTO 型に変換してから渡す

### 6. UX
- `React.memo` は重いコンポーネント（リスト・チャート）にだけ適用する
- ローディングは shadcn の `Skeleton` でスケルトン UI を表示する
- CRUD 操作後は shadcn の `toast` でユーザーに結果を通知する
- `ErrorBoundary` を設置して画面全体のクラッシュを防止する
- 検索・フィルター入力はデバウンス 300ms を入れる
- `refetchOnWindowFocus: true` でフォーカス復帰時にデータを再取得する

### 7. パフォーマンス
- 画像は必ず `next/image` を使う。`alt` 属性は必須
- 巨大ライブラリのフル import 禁止（tree-shaking が効くように named import する）
- `next-nprogress-bar` でページ遷移時にプログレスバーを表示する

### 8. エラーハンドリング
- 層ごとに責務を分ける: Repository = DB エラー、UseCase = ビジネスルール違反、API = HTTP ステータスコード
- ユーザー向けメッセージと開発者向けログを分離する
- Sentry でエラーを自動収集しつつ、自前 logger で構造化ログを出す

### 9. セキュリティ
- 環境変数をクライアントに漏らさない。クライアントで使う変数は `NEXT_PUBLIC_` プレフィックスのみ
- API ルートにはレート制限を設ける
- API 入力は zod + Prisma のパラメータ化クエリでサニタイズする

### 10. コード品質 + DB運用
- `console.log` は本番禁止。logger を使う
- 未使用コード・未使用 import を残さない（ESLint で検出）
- コメントは「Why（なぜそうしたか）」だけ書く。「What（何をしているか）」はコードで表現する
- DB マイグレーションは `prisma migrate dev` で履歴を残す。`db push` は禁止
- カスケード削除を意識し、`onDelete` を全リレーションで明示する
- スキーマ変更時は `docs/db-dictionary.md` を同時に更新する

---

## データベース（既存テーブル）

テーブル: `arb_ticks`

| カラム | 型 | 説明 |
|---|---|---|
| id | SERIAL PK | |
| timestamp | TIMESTAMPTZ | 記録日時 |
| symbol | VARCHAR(50) | 銘柄名 |
| mexc_price | DOUBLE PRECISION | MEXC価格 |
| bitget_price | DOUBLE PRECISION | Bitget価格 |
| coinex_price | DOUBLE PRECISION | CoinEX価格 |
| mx_bg_pct | DOUBLE PRECISION | MEXC-Bitget差率(%) |
| mx_cx_pct | DOUBLE PRECISION | MEXC-CoinEX差率(%) |
| bg_cx_pct | DOUBLE PRECISION | Bitget-CoinEX差率(%) |
| max_spread_pct | DOUBLE PRECISION | 最大差率(%) |
| best_pair | VARCHAR | 最大差率のペア名 |

インデックス:
- `idx_timestamp` (timestamp DESC)
- `idx_symbol_ts` (symbol, timestamp DESC)

### 重要なビジネスロジック
- **contractSize正規化**: 取引所によって1枚あたりの数量が異なる。`real_price = price * (contractSize or 1)` で統一
- **差率計算**: `mid = 平均価格`, `差率 = (価格A - 価格B) / mid * 100`
- 2取引所以上でデータがある場合のみ記録
- 異常値(10%超)の銘柄はチャートからフィルター可能

---

## 画面構成（5画面）

### 1. ダッシュボード `/`
**ヘッダー — サマリーカード×5:**
- 最終更新時刻 / 監視銘柄数 / 最大差率（銘柄名付き）/ アラート件数 / 3取引所共通銘柄数

**メインテーブル（リアルタイムランキング）:**
- カラム: ステータス(赤/橙/緑) / 銘柄名 / MEXC価格 / Bitget価格 / CoinEX価格 / MX-BG差率 / MX-CX差率 / BG-CX差率 / 最大差率
- 操作: 差率順ソート / 銘柄検索 / 取引所ペアフィルター / 表示件数切替 / 行クリック → 詳細画面遷移

**差率バーチャート（TOP20）:**
- 横棒グラフ、色分け: 赤(アラート) / オレンジ(注意) / 緑(正常)
- Y軸は動的スケール（最大値+5%）

### 2. 銘柄詳細 `/symbol/[symbol]`
- 銘柄名・シンボル
- 3取引所の現在価格（リアルタイム更新）
- 3ペアの現在差率
- 統計（24h）: 最大/最小/平均差率、データ件数
- 時系列チャート: 3本の線(MX-BG / MX-CX / BG-CX)、水平線(±0.5%オレンジ / ±1.0%赤 / 0%グレー)
- 期間切り替え: 1h / 6h / 24h / 7d

### 3. 全銘柄チャート `/charts`
- 設定: 表示銘柄数スライダー(5-50) / 並び順 / 最小平均差率フィルター / 最大差率上限フィルター
- 各銘柄ごとにミニチャート
- 銘柄名クリック → 詳細画面遷移

### 4. 設定 `/settings`
- アラート閾値（デフォルト 0.10%）
- 注意閾値（デフォルト 0.05%）
- 更新間隔（デフォルト 10秒）
- データ保持期間（デフォルト 7日）

### 5. ログ `/logs`
- 直近24hの生データテーブル
- CSV / JSONダウンロード
- ページネーション（100件ずつ）

---

## APIエンドポイント
| メソッド | パス | 説明 | 備考 |
|---|---|---|---|
| GET | `/api/realtime` | 全銘柄の現在価格差 | キャッシュ5秒 |
| GET | `/api/history?symbol=X&hours=24` | 銘柄別時系列データ | |
| GET | `/api/stats` | 統計情報 | |
| GET | `/api/logs?page=1&limit=100` | ログデータ | ページネーション付き |

---

## ディレクトリ構造
```
src/
  app/
    page.tsx                    — ダッシュボード
    symbol/[symbol]/page.tsx    — 銘柄詳細
    charts/page.tsx             — 全銘柄チャート
    settings/page.tsx           — 設定
    logs/page.tsx               — ログ
    api/
      realtime/route.ts
      history/route.ts
      stats/route.ts
      logs/route.ts
  features/
    dashboard/components/       — ダッシュボードUI
    symbol/components/          — 銘柄詳細UI
    charts/components/          — チャートUI
  controllers/
  use-cases/
  repositories/
  lib/
    prisma.ts                   — Prismaクライアント
    query-client.ts             — TanStack Query設定
  docs/
    api-docs.md
    db-dictionary.md
prisma/
  schema.prisma
```

---

## 技術的注意点

### contractSize 異常値問題
- PEPE, FLOKI 等のミーム系トークンは contractSize が 1 でない場合があり、正規化しないと差率が 200〜300% になる
- collector.py 側で `real_price = price * (contractSize or 1)` で正規化済み
- フロント側でも `max_spread_pct > 50%` 等の異常値フィルタリングを入れること

### チャート表示
- **Y軸**: 固定範囲にすると差率が小さい銘柄が棒線になる。各チャートごとに `max(data) * 1.05` で動的スケーリングする
- **折れ線**: `strokeWidth: 2` 以上、fill opacity `0.3` 以上。薄いと視認できない
- **色分け**: 3ペアを明確に区別できる配色（例: MEXC-Bitget=青, MEXC-CoinEX=赤, Bitget-CoinEX=緑）

### パフォーマンス
- ダッシュボードの30秒ポーリングは TanStack Query の `refetchInterval` で実装
- 全銘柄チャートは銘柄数が多いため、仮想スクロールまたは遅延読み込みを検討
- API は期間指定で返却行数を制限する（1h=12行, 24h=288行 目安）

---

## デプロイ構成
```
[Vercel]                    [Render]
  Next.js App  ──SQL──▶  PostgreSQL (arb_ticks)
                               ▲
                               │ INSERT (5分間隔)
                          Python collector.py (Worker)
                               │
                               ▼
                    MEXC / Bitget / CoinEX API
```

## 環境変数
| 変数名 | 用途 |
|--------|------|
| `DATABASE_URL` | Render PostgreSQL 接続文字列 |

---

## 開発上の注意
- データ収集は既存の Python `collector.py` が担当。このプロジェクトのスコープ外
- DBは既存の Render PostgreSQL をそのまま使う。Prisma schema は `db pull` で生成する
- 認証機能は不要（利用者2名のみ）
