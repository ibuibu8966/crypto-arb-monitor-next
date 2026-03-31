# API ドキュメント

## GET /api/stats
- 用途: 全銘柄の統計情報（平均スプレッド・最大最小・到達回数・現在位置）
- 認証: 不要
- キャッシュ: サーバーサイドメモリキャッシュ 30秒
- Query Parameters:
  - `hours` (number, default: 24, min: 1, max: 8760): 統計対象期間
- Response 200: `StatsDTO[]`
  ```
  { symbol, avgSpread, maxSpread, minSpread, stdSpread, count,
    bestPair, crossings20, crossings80, totalCrossings,
    signedMin, signedMax, currentPosition }
  ```
- Response 400: zodバリデーションエラー
- Response 500: データ取得エラー
- 使用use-case: getStatsUseCase
- 使用repository: SpreadRepository.getStats

## GET /api/history
- 用途: 指定銘柄の時系列データ（チャート表示用）
- 認証: 不要
- キャッシュ: なし
- Query Parameters:
  - `symbol` (string, 必須): 銘柄ペア（例: `BTC/USDT:USDT`）
  - `hours` (number, default: 24, min: 1, max: 8760): 取得期間
  - `limit` (number, default: 500, min: 1, max: 100000): 取得件数
- Response 200: `SpreadTickDTO[]`
  ```
  { id, symbol, timestamp, mexc, bitget, coinex,
    mxBgPct, mxCxPct, bgCxPct, maxSpreadPct }
  ```
- Response 400: zodバリデーションエラー
- Response 500: データ取得エラー
- 使用use-case: getHistoryUseCase
- 使用repository: SpreadRepository.findHistory

## GET /api/logs
- 用途: スプレッドログの一覧（ページネーション付き）
- 認証: 不要
- キャッシュ: なし
- Query Parameters:
  - `limit` (number, default: 50, min: 1, max: 500): ページング件数
  - `offset` (number, default: 0, min: 0): オフセット
  - `symbol` (string, optional): 銘柄フィルタ
  - `hours` (number, default: 24, min: 1, max: 168): 時間範囲
- Response 200:
  ```
  { data: SpreadTickDTO[], total: number, limit: number, offset: number }
  ```
- Response 400: zodバリデーションエラー
- Response 500: データ取得エラー
- 使用use-case: getLogsUseCase
- 使用repository: SpreadRepository.findLogs

## GET /api/realtime
- 用途: 全銘柄の最新スプレッド（リアルタイム表示用）
- 認証: 不要
- キャッシュ: s-maxage=5秒, stale-while-revalidate=10秒
- Query Parameters: なし
- Response 200: `RealtimeRow[]`
  ```
  { symbol, mexc, bitget, coinex,
    mxBgPct, mxCxPct, bgCxPct, maxSpreadPct, timestamp }
  ```
- Response 500: データ取得エラー
- 使用use-case: getRealtimeUseCase
- 使用repository: SpreadRepository.findLatest
