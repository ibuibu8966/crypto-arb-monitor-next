export type SpreadTickDTO = {
  id: number;
  symbol: string;
  timestamp: string;
  mexc: number | null;
  bitget: number | null;
  coinex: number | null;
  mxBgPct: number | null;
  mxCxPct: number | null;
  bgCxPct: number | null;
  maxSpreadPct: number | null;
};

export type RealtimeRow = {
  symbol: string;
  mexc: number | null;
  bitget: number | null;
  coinex: number | null;
  mxBgPct: number | null;
  mxCxPct: number | null;
  bgCxPct: number | null;
  maxSpreadPct: number | null;
  timestamp: string;
};

export type StatsDTO = {
  symbol: string;
  avgSpread: number;
  maxSpread: number;
  minSpread: number;
  stdSpread: number;
  count: number;
};
