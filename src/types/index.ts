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

export type PairName = "mx_bg" | "mx_cx" | "bg_cx";

export type StatsDTO = {
  symbol: string;
  avgSpread: number;
  maxSpread: number;
  minSpread: number;
  stdSpread: number;
  count: number;
  bestPair: PairName;
  crossings20: number;
  crossings80: number;
  totalCrossings: number;
  signedMin: number;
  signedMax: number;
  currentPosition: number;
};
