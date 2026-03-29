import { NextResponse } from "next/server";
import { getRealtimeUseCase } from "@/use-cases/get-realtime.use-case";

export async function getRealtimeController() {
  try {
    const data = await getRealtimeUseCase();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=10" },
    });
  } catch (error) {
    console.error("[realtime]", error);
    return NextResponse.json(
      { error: "データ取得に失敗しました" },
      { status: 500 }
    );
  }
}
