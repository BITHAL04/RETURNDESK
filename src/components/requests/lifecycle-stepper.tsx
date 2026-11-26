"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { STATUS_LABELS, type RequestStatus } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

const HAPPY_PATH: RequestStatus[] = ["OPEN", "IN_REVIEW", "APPROVED", "COMPLETED"];

/** Shows where the request is in its lifecycle; a rejected request branches off after review. */
export function LifecycleStepper({ status }: { status: RequestStatus }) {
  const rejected = status === "REJECTED";
  const steps: RequestStatus[] = rejected ? ["OPEN", "IN_REVIEW", "REJECTED"] : HAPPY_PATH;
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="flex items-center" aria-label="Request lifecycle">
      {steps.map((step, i) => {
        const done =
          i < currentIndex || (i === currentIndex && (step === "COMPLETED" || step === "REJECTED"));
        const current = i === currentIndex;
        const isReject = step === "REJECTED";
        return (
          <li
            key={step}
            className={cn("flex items-center", i < steps.length - 1 && "flex-1")}
            aria-current={current ? "step" : undefined}
          >
            <div className="flex flex-col items-center gap-1.5">
              <motion.span
                initial={false}
                animate={{ scale: current ? 1 : 0.92 }}
                className={cn(
                  "grid size-7 place-items-center rounded-full border text-[11px] font-semibold transition-colors",
                  isReject && current
                    ? "border-rose-500 bg-rose-500 text-white"
                    : done
                      ? "border-brand bg-brand text-white"
                      : current
                        ? "border-brand bg-brand-soft text-brand ring-4 ring-brand/10"
                        : "border-line-strong bg-surface text-ink-faint",
                )}
              >
                {isReject && current ? (
                  <X className="size-3.5" />
                ) : done ? (
                  <Check className="size-3.5" />
                ) : (
                  i + 1
                )}
              </motion.span>
              <span
                className={cn(
                  "text-[11.5px] whitespace-nowrap sm:text-xs",
                  current ? "font-semibold text-ink" : "text-ink-muted",
                )}
              >
                {STATUS_LABELS[step]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="relative mx-1.5 mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-line sm:mx-3">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-brand"
                  initial={false}
                  animate={{ width: i < currentIndex ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
