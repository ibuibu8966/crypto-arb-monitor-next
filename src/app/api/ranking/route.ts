import { NextRequest } from "next/server";
import { getRankingController } from "@/controllers/ranking.controller";

export async function GET(req: NextRequest) {
  return getRankingController(req);
}
