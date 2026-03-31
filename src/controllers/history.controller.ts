import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHistoryUseCase } from "@/use-cases/get-history.use-case";
import { captureError } from "@/lib/logger";

const querySchema = z.object({
  symbol: z.string().min(1),
  hours: z.coerce.number().min(1).max(8760).default(24),
});

export async function getHistoryController(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { symbol, hours } = querySchema.parse(params);
    const data = await getHistoryUseCase(symbol, hours);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    captureError("history", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
