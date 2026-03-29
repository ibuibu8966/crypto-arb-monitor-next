import { NextRequest } from "next/server";
import { getHistoryController } from "@/controllers/history.controller";

export async function GET(req: NextRequest) {
  return getHistoryController(req);
}
