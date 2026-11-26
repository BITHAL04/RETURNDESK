import { AppError } from "@/lib/errors";
import { fail } from "@/lib/api/response";

/** Unknown API routes get the standard JSON error body instead of an HTML 404 page. */
function notFound() {
  return fail(new AppError(404, "ROUTE_NOT_FOUND", "No API route matches this URL."));
}

export {
  notFound as GET,
  notFound as POST,
  notFound as PATCH,
  notFound as PUT,
  notFound as DELETE,
};
