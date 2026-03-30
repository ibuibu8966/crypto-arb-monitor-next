import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHistoryUseCase } from "@/use-cases/get-history.use-case";

const querySchema = z.object({
  symbol: z.string().min(1),
  hours: z.coerce.number().min(1).max(8760).default(24),
  limit: z.coerce.number().min(1).max(2000).default(500),
});

export async function getHistoryController(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { symbol, hours, limit } = querySchema.parse(params);
    const data = await getHistoryUseCase(symbol, hours, limit);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    // TODO: Sentry導入後に置き換え
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
