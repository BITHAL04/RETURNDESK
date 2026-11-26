"use client";

import { useSyncExternalStore } from "react";
import { Toaster as Sonner } from "sonner";

const query = "(max-width: 640px)";
const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};

/**
 * Toasts sit bottom-right on larger screens (clear of the page-header actions)
 * and top-center on phones (clear of the note composer and bottom actions).
 */
export function Toaster() {
  const isPhone = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  return (
    <Sonner
      position={isPhone ? "top-center" : "bottom-right"}
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-line !shadow-raised !font-sans",
          description: "!text-ink-muted",
        },
      }}
    />
  );
}
