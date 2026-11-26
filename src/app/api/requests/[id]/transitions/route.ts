import { handler, ok, readJson, methodNotAllowed } from "@/lib/api/response";
import { requestIdFrom } from "@/lib/api/params";
import { transitionSchema } from "@/lib/validation/requests";
import { transitionRequest } from "@/server/requests/service";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/requests/:id/transitions  { to, resolution?, refundAmount? }
 * A transition is modelled as its own resource because it carries decision data
 * and is validated against the lifecycle, unlike a plain field update.
 */
export const POST = handler(async (request: Request, context: Context) => {
  const id = await requestIdFrom(context);
  const input = transitionSchema.parse(await readJson(request));
  return ok(await transitionRequest(id, input));
});

const notAllowed = methodNotAllowed(["POST"]);
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
