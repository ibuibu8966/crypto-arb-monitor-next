import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLogsUseCase } from "@/use-cases/get-logs.use-case";
import { captureError } from "@/lib/logger";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(50),
  offset: z.coerce.number().min(0).default(0),
  symbol: z.string().optional(),
  hours: z.coerce.number().min(1).max(168).default(24),
});

export async function getLogsController(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { limit, offset, symbol, hours } = querySchema.parse(params);
    const data = await getLogsUseCase({ limit, offset, symbol, hours });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    captureError("logs", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
