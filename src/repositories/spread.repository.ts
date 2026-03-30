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

  /** 指定銘柄の時系列データ（最新のlimit件を時系列順で返す） */
  static async findHistory(symbol: string, hours: number, limit: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await prisma.spread_log.findMany({
      where: {
        symbol,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return rows.reverse();
  }

  /** 統計情報（直近N時間）— 到達回数・bestPair含む */
  static async getStats(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Step 1: 基本統計 + ペアごとのmin/max をSQLで取得
    const result = await prisma.$queryRaw<
      {
        symbol: string;
        avg_spread: number;
        max_spread: number;
        min_spread: number;
        std_spread: number;
        count: bigint;
        min_mx_bg: number | null;
        max_mx_bg: number | null;
        min_mx_cx: number | null;
        max_mx_cx: number | null;
        min_bg_cx: number | null;
        max_bg_cx: number | null;
      }[]
    >(Prisma.sql`
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
      FROM spread_log
      WHERE timestamp >= ${since}
        AND max_spread_pct IS NOT NULL
        AND ABS(max_spread_pct) <= 50
      GROUP BY symbol
      ORDER BY avg_spread DESC
    `);

    // Step 2: クロッシング計算用に時系列データを取得
    const rows = await prisma.$queryRaw<
      {
        symbol: string;
        mx_bg_pct: number | null;
        mx_cx_pct: number | null;
        bg_cx_pct: number | null;
      }[]
    >(Prisma.sql`
      SELECT symbol, mx_bg_pct, mx_cx_pct, bg_cx_pct
      FROM spread_log
      WHERE timestamp >= ${since}
        AND max_spread_pct IS NOT NULL
        AND ABS(max_spread_pct) <= 50
      ORDER BY symbol, timestamp ASC
    `);

    // Step 3: シンボルごとにグループ化
    const groupedRows = new Map<string, { mx_bg: number; mx_cx: number; bg_cx: number }[]>();
    for (const r of rows) {
      const arr = groupedRows.get(r.symbol) ?? [];
      arr.push({
        mx_bg: Number(r.mx_bg_pct ?? 0),
        mx_cx: Number(r.mx_cx_pct ?? 0),
        bg_cx: Number(r.bg_cx_pct ?? 0),
      });
      groupedRows.set(r.symbol, arr);
    }

    return result.map((r) => {
      const pairRanges = [
        { name: "mx_bg" as const, min: Number(r.min_mx_bg ?? 0), max: Number(r.max_mx_bg ?? 0) },
        { name: "mx_cx" as const, min: Number(r.min_mx_cx ?? 0), max: Number(r.max_mx_cx ?? 0) },
        { name: "bg_cx" as const, min: Number(r.min_bg_cx ?? 0), max: Number(r.max_bg_cx ?? 0) },
      ];

      const symbolRows = groupedRows.get(r.symbol) ?? [];

      // Step 4: 各ペアのクロッシングを計算
      let bestPair = pairRanges[0];
      let bestC20 = 0;
      let bestC80 = 0;
      let bestTotal = 0;

      for (const pair of pairRanges) {
        const range = pair.max - pair.min;
        if (range === 0) continue;

        const line20 = pair.min + range * 0.2;
        const line80 = pair.min + range * 0.8;

        let c20 = 0;
        let c80 = 0;
        for (let i = 1; i < symbolRows.length; i++) {
          const prev = symbolRows[i - 1][pair.name];
          const curr = symbolRows[i][pair.name];
          // 80%ライン上方クロッシング（下→上）
          if (prev < line80 && curr >= line80) c80++;
          // 20%ライン下方クロッシング（上→下）
          if (prev > line20 && curr <= line20) c20++;
        }

        const total = c20 + c80;
        if (total > bestTotal) {
          bestPair = pair;
          bestC20 = c20;
          bestC80 = c80;
          bestTotal = total;
        }
      }

      // 最新データポイントから乖離率を計算
      const pairRange = bestPair.max - bestPair.min;
      let currentPosition = 50;
      if (pairRange > 0 && symbolRows.length > 0) {
        const latest = symbolRows[symbolRows.length - 1][bestPair.name];
        currentPosition = ((latest - bestPair.min) / pairRange) * 100;
      }

      return {
        symbol: r.symbol,
        avgSpread: Number(r.avg_spread),
        maxSpread: Number(r.max_spread),
        minSpread: Number(r.min_spread),
        stdSpread: Number(r.std_spread ?? 0),
        count: Number(r.count),
        bestPair: bestPair.name,
        crossings20: bestC20,
        crossings80: bestC80,
        totalCrossings: bestTotal,
        signedMin: bestPair.min,
        signedMax: bestPair.max,
        currentPosition,
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
        orderBy: { timestamp: "desc" },
        skip: opts.offset,
        take: opts.limit,
      }),
      prisma.spread_log.count({ where }),
    ]);

    return { rows, total };
  }
}
