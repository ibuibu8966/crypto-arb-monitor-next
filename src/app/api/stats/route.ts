import { NextRequest } from "next/server";
import { getStatsController } from "@/controllers/stats.controller";

export async function GET(req: NextRequest) {
  return getStatsController(req);
}
