"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Package, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ApiClientError } from "@/lib/api/client";
import { REASON_LABELS, RETURN_REASONS } from "@/lib/domain/constants";
import { createRequestSchema, type CreateRequestInput } from "@/lib/validation/requests";

type FormInput = z.input<typeof createRequestSchema>;

export type RequestFormValues = CreateRequestInput;

const EMPTY: FormInput = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  orderId: "",
  itemSku: "",
  itemName: "",
  quantity: 1,
  reason: "" as FormInput["reason"],
};

/**
 * Shared by the create and edit screens. Client-side validation uses the same Zod
 * schema as the API for instant feedback; the server still re-validates everything
 * and its field errors are mapped back onto the inputs.
 */
export function RequestForm({
  defaultValues,
  submitLabel,
  cancelHref,
  onSubmit,
}: {
  defaultValues?: Partial<FormInput>;
  submitLabel: string;
  cancelHref: string;
  /** Receives only the fields the agent changed (all fields on create). */
  onSubmit: (values: RequestFormValues, changed: Partial<RequestFormValues>) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<ApiClientError | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormInput, unknown, CreateRequestInput>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: "onTouched",
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    const changed = Object.fromEntries(
      Object.entries(values).filter(([key]) => dirtyFields[key as keyof FormInput]),
    ) as Partial<RequestFormValues>;
    try {
      await onSubmit(values, changed);
    } catch (error) {
      if (!(error instanceof ApiClientError)) throw error;
      const fields = error.fieldErrors();
      for (const [field, message] of Object.entries(fields)) {
        if (field in EMPTY) setError(field as keyof FormInput, { message });
      }
      setServerError(error);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <AnimatePresence>
        {serverError && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-3 rounded-xl border border-rose-200 bg-danger-soft px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <div>
                <p className="font-medium text-rose-900">
                  {serverError.code === "DUPLICATE_LIVE_REQUEST"
                    ? "This item already has a live request"
                    : "The request could not be saved"}
                </p>
                <p className="mt-0.5 text-rose-800/90">{serverError.message}</p>
                {serverError.code === "DUPLICATE_LIVE_REQUEST" &&
                  typeof (serverError.details as { existingReference?: string } | undefined)
                    ?.existingReference === "string" && (
                    <Link
                      href={`/requests?q=${(serverError.details as { existingReference: string }).existingReference}`}
                      className="mt-1.5 inline-block font-medium text-rose-900 underline underline-offset-2"
                    >
                      Find{" "}
                      {(serverError.details as { existingReference: string }).existingReference}
                    </Link>
                  )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          <User className="size-4 text-ink-muted" aria-hidden />
          <h2 className="text-sm font-semibold">Customer</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Full name" error={errors.customerName?.message} className="sm:col-span-2">
            {(a) => (
              <Input
                {...a}
                {...register("customerName")}
                autoComplete="off"
                placeholder="e.g. Priya Nair"
              />
            )}
          </Field>
          <Field label="Email" error={errors.customerEmail?.message}>
            {(a) => (
              <Input
                {...a}
                {...register("customerEmail")}
                type="email"
                inputMode="email"
                placeholder="priya@example.com"
              />
            )}
          </Field>
          <Field label="Phone" optional error={errors.customerPhone?.message}>
            {(a) => (
              <Input
                {...a}
                {...register("customerPhone")}
                type="tel"
                inputMode="tel"
                placeholder="+91 98450 11872"
              />
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          <Package className="size-4 text-ink-muted" aria-hidden />
          <h2 className="text-sm font-semibold">Order &amp; item</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Order ID" error={errors.orderId?.message}>
            {(a) => (
              <Input
                {...a}
                {...register("orderId")}
                placeholder="ORD-24051"
                className="font-mono"
              />
            )}
          </Field>
          <Field
            label="Item SKU"
            error={errors.itemSku?.message}
            hint="Identifies the item on the order. One live request per order item."
          >
            {(a) => (
              <Input
                {...a}
                {...register("itemSku")}
                placeholder="MUG-CER-350"
                className="font-mono"
              />
            )}
          </Field>
          <Field label="Item name" error={errors.itemName?.message} className="sm:col-span-2">
            {(a) => <Input {...a} {...register("itemName")} placeholder="Stoneware Mug 350 ml" />}
          </Field>
          <Field label="Quantity" error={errors.quantity?.message}>
            {(a) => (
              <Input
                {...a}
                {...register("quantity", { valueAsNumber: true })}
                type="number"
                min={1}
                max={1000}
                step={1}
                inputMode="numeric"
              />
            )}
          </Field>
          <Field label="Reason for return" error={errors.reason?.message}>
            {(a) => (
              <Select {...a} {...register("reason")}>
                <option value="" disabled>
                  Choose a reason…
                </option>
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-sm font-medium text-ink shadow-card hover:bg-surface-muted"
        >
          Cancel
        </Link>
        <Button type="submit" size="lg" loading={isSubmitting} className="justify-center">
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
