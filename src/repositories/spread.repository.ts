import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PairName } from "@/types";

/** hours → キャッシュテーブルのtime_rangeラベル変換 */
const HOURS_TO_RANGE: Record<number, string> = {
  1: "1h",
  4: "4h",
  12: "12h",
  24: "24h",
  168: "1W",
  720: "1M",
};

export class SpreadRepository {
  /** 最新タイムスタンプの全銘柄データを取得（リアルタイム） */
  static async findLatest() {
    const result = await prisma.$queryRaw<
      {
        id: number;
        symbol: string;
        timestamp: Date;
        mexc: number | null;
        bitget: number | null;
        coinex: number | null;
        mx_bg_pct: number | null;
        mx_cx_pct: number | null;
        bg_cx_pct: number | null;
        max_spread_pct: number | null;
      }[]
    >(Prisma.sql`
      SELECT * FROM spread_log
      WHERE timestamp = (SELECT MAX(timestamp) FROM spread_log)
      ORDER BY max_spread_pct DESC NULLS LAST
    `);
    return result;
  }

  /** 指定銘柄の時系列データ（最大300ポイントにダウンサンプリング） */
  static async findHistory(symbol: string, hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const MAX_POINTS = 300;

    const rows = await prisma.$queryRaw<
      {
        id: number;
        symbol: string;
        timestamp: Date;
        mexc: number | null;
        bitget: number | null;
        coinex: number | null;
        mx_bg_pct: number | null;
        mx_cx_pct: number | null;
        bg_cx_pct: number | null;
        max_spread_pct: number | null;
      }[]
    >(Prisma.sql`
      WITH numbered AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY timestamp ASC) as rn,
               COUNT(*) OVER () as total
        FROM spread_log
        WHERE symbol = ${symbol} AND timestamp >= ${since}
      )
      SELECT id, symbol, timestamp, mexc, bitget, coinex,
             mx_bg_pct, mx_cx_pct, bg_cx_pct, max_spread_pct
      FROM numbered
      WHERE total <= ${MAX_POINTS}
         OR rn % GREATEST(1, (total / ${MAX_POINTS})::int) = 0
         OR rn = 1 OR rn = total
      ORDER BY timestamp ASC
    `);
    return rows;
  }

  /** 統計情報（キャッシュから取得。キャッシュなければ直接クエリ） */
  static async getStats(hours: number) {
    const timeRange = HOURS_TO_RANGE[hours];

    // キャッシュテーブルから取得を試みる
    if (timeRange) {
      const cached = await prisma.spread_stats_cache.findMany({
        where: { time_range: timeRange },
        orderBy: { avg_spread: "desc" },
      });

      if (cached.length > 0) {
        return cached.map((r) => ({
          symbol: r.symbol,
          avgSpread: r.avg_spread ?? 0,
          maxSpread: r.max_spread ?? 0,
          minSpread: r.min_spread ?? 0,
          stdSpread: r.std_spread ?? 0,
          count: r.count ?? 0,
          bestPair: (r.best_pair ?? "mx_bg") as PairName,
          crossings20: r.crossings_20 ?? 0,
          crossings80: r.crossings_80 ?? 0,
          totalCrossings: (r.crossings_20 ?? 0) + (r.crossings_80 ?? 0),
          signedMin: r.signed_min ?? 0,
          signedMax: r.signed_max ?? 0,
          currentPosition: r.current_pos ?? 50,
          reversionProb: (r as unknown as { reversion_prob?: number }).reversion_prob ?? 0,
          halfLife:      (r as unknown as { half_life?: number }).half_life ?? 0,
          costRatio:     (r as unknown as { cost_ratio?: number }).cost_ratio ?? 0,
          execVolume:    (r as unknown as { exec_volume?: number }).exec_volume ?? 0,
          volStability:  (r as unknown as { vol_stability?: number }).vol_stability ?? 0,
          arbScore:      (r as unknown as { arb_score?: number }).arb_score ?? 0,
        }));
      }
    }

    // キャッシュがなければ従来通り直接クエリ（フォールバック）
    return SpreadRepository._getStatsDirectQuery(hours);
  }

  /** 直接クエリ版getStats（フォールバック用） */
  private static async _getStatsDirectQuery(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const result = await prisma.$queryRaw<
      {
        symbol: string;
        avg_spread: number;
        max_spread: number;
        min_spread: number;
        std_spread: number;
        count: bigint;
        min_mx_bg: number; max_mx_bg: number;
        min_mx_cx: number; max_mx_cx: number;
        min_bg_cx: number; max_bg_cx: number;
        c80_mx_bg: number; c20_mx_bg: number;
        c80_mx_cx: number; c20_mx_cx: number;
        c80_bg_cx: number; c20_bg_cx: number;
        latest_mx_bg: number | null;
        latest_mx_cx: number | null;
        latest_bg_cx: number | null;
      }[]
    >(Prisma.sql`
      WITH base AS (
        SELECT symbol, timestamp, mx_bg_pct, mx_cx_pct, bg_cx_pct, max_spread_pct
        FROM spread_log
        WHERE timestamp >= ${since}
          AND max_spread_pct IS NOT NULL
          AND ABS(max_spread_pct) <= 50
      ),
      stats AS (
        SELECT
          symbol,
          AVG(max_spread_pct) as avg_spread,
          MAX(max_spread_pct) as max_spread,
          MIN(max_spread_pct) as min_spread,
          STDDEV(max_spread_pct) as std_spread,
          COUNT(*) as count,
          MIN(mx_bg_pct) as min_mx_bg, MAX(mx_bg_pct) as max_mx_bg,
          MIN(mx_cx_pct) as min_mx_cx, MAX(mx_cx_pct) as max_mx_cx,
          MIN(bg_cx_pct) as min_bg_cx, MAX(bg_cx_pct) as max_bg_cx
        FROM base
        GROUP BY symbol
      ),
      with_prev AS (
        SELECT
          b.symbol,
          b.mx_bg_pct, b.mx_cx_pct, b.bg_cx_pct,
          LAG(b.mx_bg_pct) OVER w as prev_mx_bg,
          LAG(b.mx_cx_pct) OVER w as prev_mx_cx,
          LAG(b.bg_cx_pct) OVER w as prev_bg_cx,
          ROW_NUMBER() OVER (PARTITION BY b.symbol ORDER BY b.timestamp DESC) as rn
        FROM base b
        WINDOW w AS (PARTITION BY b.symbol ORDER BY b.timestamp)
      ),
      crossings AS (
        SELECT
          wp.symbol,
          COALESCE(SUM(CASE WHEN wp.prev_mx_bg < s.min_mx_bg + (s.max_mx_bg - s.min_mx_bg) * 0.8
                              AND wp.mx_bg_pct >= s.min_mx_bg + (s.max_mx_bg - s.min_mx_bg) * 0.8
                         THEN 1 ELSE 0 END), 0)::int as c80_mx_bg,
          COALESCE(SUM(CASE WHEN wp.prev_mx_bg > s.min_mx_bg + (s.max_mx_bg - s.min_mx_bg) * 0.2
                              AND wp.mx_bg_pct <= s.min_mx_bg + (s.max_mx_bg - s.min_mx_bg) * 0.2
                         THEN 1 ELSE 0 END), 0)::int as c20_mx_bg,
          COALESCE(SUM(CASE WHEN wp.prev_mx_cx < s.min_mx_cx + (s.max_mx_cx - s.min_mx_cx) * 0.8
                              AND wp.mx_cx_pct >= s.min_mx_cx + (s.max_mx_cx - s.min_mx_cx) * 0.8
                         THEN 1 ELSE 0 END), 0)::int as c80_mx_cx,
          COALESCE(SUM(CASE WHEN wp.prev_mx_cx > s.min_mx_cx + (s.max_mx_cx - s.min_mx_cx) * 0.2
                              AND wp.mx_cx_pct <= s.min_mx_cx + (s.max_mx_cx - s.min_mx_cx) * 0.2
                         THEN 1 ELSE 0 END), 0)::int as c20_mx_cx,
          COALESCE(SUM(CASE WHEN wp.prev_bg_cx < s.min_bg_cx + (s.max_bg_cx - s.min_bg_cx) * 0.8
                              AND wp.bg_cx_pct >= s.min_bg_cx + (s.max_bg_cx - s.min_bg_cx) * 0.8
                         THEN 1 ELSE 0 END), 0)::int as c80_bg_cx,
          COALESCE(SUM(CASE WHEN wp.prev_bg_cx > s.min_bg_cx + (s.max_bg_cx - s.min_bg_cx) * 0.2
                              AND wp.bg_cx_pct <= s.min_bg_cx + (s.max_bg_cx - s.min_bg_cx) * 0.2
                         THEN 1 ELSE 0 END), 0)::int as c20_bg_cx,
          MAX(CASE WHEN wp.rn = 1 THEN wp.mx_bg_pct END) as latest_mx_bg,
          MAX(CASE WHEN wp.rn = 1 THEN wp.mx_cx_pct END) as latest_mx_cx,
          MAX(CASE WHEN wp.rn = 1 THEN wp.bg_cx_pct END) as latest_bg_cx
        FROM with_prev wp
        JOIN stats s ON wp.symbol = s.symbol
        GROUP BY wp.symbol
      )
      SELECT s.*, c.c80_mx_bg, c.c20_mx_bg, c.c80_mx_cx, c.c20_mx_cx,
             c.c80_bg_cx, c.c20_bg_cx, c.latest_mx_bg, c.latest_mx_cx, c.latest_bg_cx
      FROM stats s
      JOIN crossings c ON s.symbol = c.symbol
      ORDER BY s.avg_spread DESC
    `);

    return result.map((r) => {
      const pairs = [
        {
          name: "mx_bg" as const,
          min: Number(r.min_mx_bg ?? 0), max: Number(r.max_mx_bg ?? 0),
          c20: Number(r.c20_mx_bg), c80: Number(r.c80_mx_bg),
          latest: r.latest_mx_bg,
        },
        {
          name: "mx_cx" as const,
          min: Number(r.min_mx_cx ?? 0), max: Number(r.max_mx_cx ?? 0),
          c20: Number(r.c20_mx_cx), c80: Number(r.c80_mx_cx),
          latest: r.latest_mx_cx,
        },
        {
          name: "bg_cx" as const,
          min: Number(r.min_bg_cx ?? 0), max: Number(r.max_bg_cx ?? 0),
          c20: Number(r.c20_bg_cx), c80: Number(r.c80_bg_cx),
          latest: r.latest_bg_cx,
        },
      ];

      let best = pairs[0];
      for (const p of pairs) {
        if (p.c20 + p.c80 > best.c20 + best.c80) best = p;
      }

      const pairRange = best.max - best.min;
      let currentPosition = 50;
      if (pairRange > 0 && best.latest != null) {
        currentPosition = ((Number(best.latest) - best.min) / pairRange) * 100;
      }

      return {
        symbol: r.symbol,
        avgSpread: Number(r.avg_spread),
        maxSpread: Number(r.max_spread),
        minSpread: Number(r.min_spread),
        stdSpread: Number(r.std_spread ?? 0),
        count: Number(r.count),
        bestPair: best.name,
        crossings20: best.c20,
        crossings80: best.c80,
        totalCrossings: best.c20 + best.c80,
        signedMin: best.min,
        signedMax: best.max,
        currentPosition,
        reversionProb: 0,
        halfLife: 0,
        costRatio: 0,
        execVolume: 0,
        volStability: 0,
        arbScore: 0,
      };
    });
  }

  /** ログ一覧（ページネーション対応） */
  static async findLogs(opts: {
    limit: number;
    offset: number;
    symbol?: string;
    hours?: number;
  }) {
    const since = new Date(
      Date.now() - (opts.hours ?? 24) * 60 * 60 * 1000
    );

    const where: Prisma.spread_logWhereInput = {
      timestamp: { gte: since },
      ...(opts.symbol
        ? { symbol: { contains: opts.symbol, mode: "insensitive" as const } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.spread_log.findMany({
        where,
        select: {
          id: true,
          symbol: true,
          timestamp: true,
          mexc: true,
          bitget: true,
          coinex: true,
          mx_bg_pct: true,
          mx_cx_pct: true,
          bg_cx_pct: true,
          max_spread_pct: true,
        },
        orderBy: { timestamp: "desc" },
        skip: opts.offset,
        take: opts.limit,
      }),
      prisma.spread_log.count({ where }),
    ]);

    return { rows, total };
  }
}
