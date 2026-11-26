import { handler, ok } from "@/lib/api/response";
import { getStats } from "@/server/requests/service";

/** GET /api/stats — dashboard totals by status and reason, refund total and recent requests. */
export const GET = handler(async () => ok(await getStats()));
