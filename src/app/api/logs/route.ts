import { NextRequest } from "next/server";
import { getLogsController } from "@/controllers/logs.controller";

export async function GET(req: NextRequest) {
  return getLogsController(req);
}
