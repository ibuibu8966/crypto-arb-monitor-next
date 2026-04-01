import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStatsUseCase } from "@/use-cases/get-stats.use-case";
import { captureError } from "@/lib/logger";

const querySchema = z.object({
  hours: z.coerce.number().min(1).max(8760).default(24),
});

export async function getRankingController(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { hours } = querySchema.parse(params);

    const all = await getStatsUseCase(hours);
    const ranked = all
      .filter((s) => s.arbScore > 0)
      .sort((a, b) => b.arbScore - a.arbScore);

    return NextResponse.json(ranked);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    captureError("ranking", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
