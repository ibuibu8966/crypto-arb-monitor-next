# データ辞書

## spread_log テーブル

3取引所（MEXC / Bitget / CoinEX）の先物価格と価格差率を5秒間隔で記録するテーブル。
唯一のテーブルであり、全てのAPI（realtime / history / stats / logs）のデータソース。

| カラム | 型 | NULL | 説明 | 情報源 |
|--------|------|------|------|--------|
| id | Int (PK) | NO | 自動採番 | - |
| timestamp | Timestamptz | NO | 記録時刻（UTC） | collector.py |
| symbol | VarChar(50) | NO | 銘柄ペア（例: BTC/USDT:USDT） | ccxt |
| mexc | Float | YES | MEXC価格（USD） | ccxt watch_tickers |
| bitget | Float | YES | Bitget価格（USD） | ccxt watch_tickers |
| coinex | Float | YES | CoinEX価格（USD） | ccxt watch_tickers |
| mx_bg_pct | Float | YES | MEXC-Bitget 価格差率（%） | collector.py で計算 |
| mx_cx_pct | Float | YES | MEXC-CoinEX 価格差率（%） | collector.py で計算 |
| bg_cx_pct | Float | YES | Bitget-CoinEX 価格差率（%） | collector.py で計算 |
| max_spread_pct | Float | YES | 3ペア中の最大差率（絶対値, %） | collector.py で計算 |

### インデックス

| 名前 | カラム | 用途 |
|------|--------|------|
| idx_symbol_ts | (symbol, timestamp DESC) | 銘柄別の時系列取得（history API） |
| idx_timestamp | (timestamp DESC) | 時間範囲でのフィルタ（logs / stats API） |

### 価格差率の計算式

```
mx_bg_pct = (mexc - bitget) / ((mexc + bitget) / 2) * 100
```

正の値 = 左側の取引所が高い、負の値 = 右側の取引所が高い。

### データライフサイクル

- **書き込み**: collector.py が5秒間隔でINSERT
- **パージ**: collector.py が7日より古いデータを定期削除
- **読み取り**: Next.js API（realtime / history / stats / logs）
