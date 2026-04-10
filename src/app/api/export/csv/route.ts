import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 10000;

const CSV_HEADER =
  "id,timestamp,symbol,mexc,bitget,coinex,mx_bg_pct,mx_cx_pct,bg_cx_pct,max_spread_pct\n";

export async function GET() {
  try {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(CSV_HEADER));

          let cursor: number | undefined;
          let hasMore = true;

          while (hasMore) {
            const rows = await prisma.spread_log.findMany({
              take: BATCH_SIZE,
              ...(cursor
                ? { skip: 1, cursor: { id: cursor } }
                : {}),
              orderBy: { id: "asc" },
              select: {
                id: true,
                timestamp: true,
                symbol: true,
                mexc: true,
                bitget: true,
                coinex: true,
                mx_bg_pct: true,
                mx_cx_pct: true,
                bg_cx_pct: true,
                max_spread_pct: true,
              },
            });

            if (rows.length === 0) {
              hasMore = false;
              break;
            }

            const chunk = rows
              .map(
                (r) =>
                  `${r.id},${r.timestamp.toISOString()},${r.symbol},${r.mexc ?? ""},${r.bitget ?? ""},${r.coinex ?? ""},${r.mx_bg_pct ?? ""},${r.mx_cx_pct ?? ""},${r.bg_cx_pct ?? ""},${r.max_spread_pct ?? ""}`
              )
              .join("\n") + "\n";

            controller.enqueue(encoder.encode(chunk));

            cursor = rows[rows.length - 1].id;

            if (rows.length < BATCH_SIZE) {
              hasMore = false;
            }
          }

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    const filename = `spread_log_all_${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    captureError("export-csv", error);
    return NextResponse.json(
      { error: "CSV生成に失敗しました" },
      { status: 500 }
    );
  }
}
