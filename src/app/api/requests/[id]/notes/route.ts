import { handler, ok, readJson, methodNotAllowed } from "@/lib/api/response";
import { requestIdFrom } from "@/lib/api/params";
import { createNoteSchema } from "@/lib/validation/requests";
import { addNote, listNotes } from "@/server/requests/service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/requests/:id/notes — every note, oldest first. */
export const GET = handler(async (_request: Request, context: Context) => {
  return ok(await listNotes(await requestIdFrom(context)));
});

/**
 * POST /api/requests/:id/notes — allowed in every status, including decided ones.
 * Notes are append-only: there is deliberately no PATCH or DELETE.
 */
export const POST = handler(async (request: Request, context: Context) => {
  const id = await requestIdFrom(context);
  const input = createNoteSchema.parse(await readJson(request));
  return ok(await addNote(id, input), { status: 201 });
});

const notAllowed = methodNotAllowed(["GET", "POST"]); // Notes are append-only, so PATCH and DELETE are refused.
export { notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
