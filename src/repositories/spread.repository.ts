import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class SpreadRepository {
  /** 最新タイムスタンプの全銘柄データを取得 */
  static async findLatest() {
    // raw queryで最新タイムスタンプのデータを一括取得（タイムスタンプ精度の問題を回避）
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

  /** 指定銘柄の時系列データ */
  static async findHistory(symbol: string, hours: number, limit: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return prisma.spread_log.findMany({
      where: {
        symbol,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: "asc" },
      take: limit,
    });
  }

  /** 統計情報（直近N時間） */
  static async getStats(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await prisma.$queryRaw<
      {
        symbol: string;
        avg_spread: number;
        max_spread: number;
        min_spread: number;
        std_spread: number;
        count: bigint;
      }[]
    >(Prisma.sql`
      SELECT
        symbol,
        AVG(max_spread_pct) as avg_spread,
        MAX(max_spread_pct) as max_spread,
        MIN(max_spread_pct) as min_spread,
        STDDEV(max_spread_pct) as std_spread,
        COUNT(*) as count
      FROM spread_log
      WHERE timestamp >= ${since}
        AND max_spread_pct IS NOT NULL
      GROUP BY symbol
      ORDER BY avg_spread DESC
    `);

    return result.map((r) => ({
      symbol: r.symbol,
      avgSpread: Number(r.avg_spread),
      maxSpread: Number(r.max_spread),
      minSpread: Number(r.min_spread),
      stdSpread: Number(r.std_spread ?? 0),
      count: Number(r.count),
    }));
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
        orderBy: { timestamp: "desc" },
        skip: opts.offset,
        take: opts.limit,
      }),
      prisma.spread_log.count({ where }),
    ]);

    return { rows, total };
  }
}
