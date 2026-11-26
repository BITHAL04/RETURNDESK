import { z } from "zod";
import { errors } from "../errors";

const uuid = z.uuid();

/** A malformed id cannot identify any request, so it is reported as not found. */
export async function requestIdFrom(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) throw errors.notFound();
  return id;
}
