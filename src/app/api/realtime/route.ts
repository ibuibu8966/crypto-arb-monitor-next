import { getRealtimeController } from "@/controllers/realtime.controller";

export async function GET() {
  return getRealtimeController();
}
