/**
 * Request payload and query validation. These schemas are the only place input
 * shape is defined; the API handlers and the UI forms both import them.
 */
import { z } from "zod";
import { REQUEST_STATUSES, RESOLUTIONS, RETURN_REASONS } from "../domain/constants";

const trimmed = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

const optionalPhone = z
  .string()
  .trim()
  .max(32, "Phone must be at most 32 characters.")
  .regex(/^$|^\+?[0-9()\-\s]{6,31}$/, "Phone may contain digits, spaces, +, - and brackets only.")
  .nullish()
  .transform((v) => (v ? v : null));

export const requestDetailsShape = {
  customerName: trimmed("Customer name", 120),
  customerEmail: z
    .string({ error: "Customer email is required." })
    .trim()
    .toLowerCase()
    .max(254, "Customer email must be at most 254 characters.")
    .pipe(z.email("Enter a valid email address.")),
  customerPhone: optionalPhone,
  orderId: trimmed("Order ID", 64).regex(
    /^[A-Za-z0-9#._-]+$/,
    "Order ID may contain letters, numbers, #, ., _ and - only.",
  ),
  itemSku: trimmed("Item SKU", 64).regex(
    /^[A-Za-z0-9._-]+$/,
    "Item SKU may contain letters, numbers, ., _ and - only.",
  ),
  itemName: trimmed("Item name", 200),
  quantity: z
    .number({ error: "Quantity must be a whole number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1000, "Quantity must be at most 1000."),
  reason: z.enum(RETURN_REASONS, {
    error: `Reason must be one of: ${RETURN_REASONS.join(", ")}.`,
  }),
};

/** Unknown keys (e.g. a client-supplied `reference` or `status`) are rejected, not silently dropped. */
export const createRequestSchema = z.strictObject(requestDetailsShape);
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const updateRequestSchema = z
  .strictObject({
    customerName: requestDetailsShape.customerName.optional(),
    customerEmail: requestDetailsShape.customerEmail.optional(),
    customerPhone: optionalPhone.optional(),
    orderId: requestDetailsShape.orderId.optional(),
    itemSku: requestDetailsShape.itemSku.optional(),
    itemName: requestDetailsShape.itemName.optional(),
    quantity: requestDetailsShape.quantity.optional(),
    reason: requestDetailsShape.reason.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update.",
  });
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

/** Money arrives as a number or numeric string and is normalised to a 2-dp string for NUMERIC(10,2). */
const money = z.union([z.number(), z.string().trim()]).transform((v, ctx) => {
  const text = typeof v === "number" ? String(v) : v;
  if (!/^-?\d{1,8}(\.\d{1,2})?$/.test(text) || !Number.isFinite(Number(text))) {
    ctx.addIssue({
      code: "custom",
      message:
        "Refund amount must be a number with at most 2 decimal places and below 100,000,000.",
    });
    return z.NEVER;
  }
  return Number(text).toFixed(2);
});

export const transitionSchema = z.strictObject({
  to: z.enum(REQUEST_STATUSES, {
    error: `Target status must be one of: ${REQUEST_STATUSES.join(", ")}.`,
  }),
  resolution: z
    .enum(RESOLUTIONS, { error: `Resolution must be one of: ${RESOLUTIONS.join(", ")}.` })
    .nullish(),
  refundAmount: money.nullish(),
});
export type TransitionInput = z.infer<typeof transitionSchema>;

export const createNoteSchema = z.strictObject({
  author: trimmed("Author", 80),
  body: trimmed("Note", 5000),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const SORTABLE_FIELDS = [
  "createdAt",
  "updatedAt",
  "reference",
  "customerName",
  "status",
  "quantity",
] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

/** Accepts `status=OPEN&status=APPROVED` or `status=OPEN,APPROVED`. */
const multiValue = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z
    .array(z.string())
    .transform((list) =>
      list
        .flatMap((v) => v.split(","))
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values, { error: `${label} must be one of: ${values.join(", ")}.` })))
    .transform((list) => [...new Set(list)]);

export const listQuerySchema = z.strictObject({
  q: z.string().trim().max(100, "Search must be at most 100 characters.").optional(),
  status: multiValue(REQUEST_STATUSES, "status").default([]),
  reason: multiValue(RETURN_REASONS, "reason").default([]),
  sort: z
    .enum(SORTABLE_FIELDS, { error: `sort must be one of: ${SORTABLE_FIELDS.join(", ")}.` })
    .default("createdAt"),
  order: z.enum(["asc", "desc"], { error: "order must be asc or desc." }).default("desc"),
  page: z.coerce
    .number({ error: "page must be a whole number." })
    .int("page must be a whole number.")
    .min(1, "page must be at least 1.")
    .default(1),
  pageSize: z.coerce
    .number({ error: "pageSize must be a whole number." })
    .int("pageSize must be a whole number.")
    .min(1, "pageSize must be at least 1.")
    .max(100, "pageSize must be at most 100.")
    .default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Converts URLSearchParams into the plain object shape listQuerySchema expects. */
export function searchParamsToObject(params: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = key === "status" || key === "reason" ? all : all[all.length - 1];
  }
  return out;
}
