import { handler, ok, readJson } from "@/lib/api/response";
import { requestIdFrom } from "@/lib/api/params";
import { updateRequestSchema } from "@/lib/validation/requests";
import { getRequestDetail, removeRequest, updateRequest } from "@/server/requests/service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/requests/:id — the request with its notes and audit history. Removed requests are 404. */
export const GET = handler(async (_request: Request, context: Context) => {
  return ok(await getRequestDetail(await requestIdFrom(context)));
});

/** PATCH /api/requests/:id — correct customer/item details while the request is undecided. */
export const PATCH = handler(async (request: Request, context: Context) => {
  const id = await requestIdFrom(context);
  const input = updateRequestSchema.parse(await readJson(request));
  return ok(await updateRequest(id, input));
});

/** DELETE /api/requests/:id — soft delete (OPEN or REJECTED only). The row, notes and history are kept. */
export const DELETE = handler(async (_request: Request, context: Context) => {
  return ok(await removeRequest(await requestIdFrom(context)));
});
