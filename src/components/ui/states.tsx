"use client";

import { AlertTriangle, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center px-6 py-14 text-center"
    >
      <div className="mb-4 grid size-12 place-items-center rounded-xl border border-line bg-surface-muted shadow-card">
        <Icon className="size-5 text-ink-muted" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-xl border border-rose-200 bg-danger-soft">
        <AlertTriangle className="size-5 text-danger" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-ink">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
