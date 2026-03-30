import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStatsUseCase } from "@/use-cases/get-stats.use-case";

const querySchema = z.object({
  hours: z.coerce.number().min(1).max(8760).default(24),
});

export async function getStatsController(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { hours } = querySchema.parse(params);
    const data = await getStatsUseCase(hours);
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
