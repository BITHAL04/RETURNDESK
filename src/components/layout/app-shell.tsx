"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { Menu, Undo2, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-brand text-white shadow-[0_0_0_1px_rgb(255_255_255/0.12)_inset]">
        <Undo2 className="size-4" strokeWidth={2.4} aria-hidden />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-chrome-ink-strong">
        ReturnDesk
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="space-y-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
              active
                ? "text-chrome-ink-strong"
                : "text-chrome-ink hover:bg-chrome-raised/70 hover:text-chrome-ink-strong",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg bg-chrome-raised shadow-[0_0_0_1px_rgb(255_255_255/0.05)_inset]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            {active && (
              <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-indigo-400" />
            )}
            <Icon className="relative size-4 shrink-0" aria-hidden />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="rounded-xl border border-chrome-line bg-chrome-raised/60 p-3">
      <p className="text-[12px] font-medium text-chrome-ink-strong">Support desk</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-chrome-ink">
        Every rule is enforced on the server, so you only see legal actions.
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh lg:pl-60">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-chrome-line bg-chrome px-3 py-4 lg:flex">
          <Brand />
          <div className="mt-6 flex-1">
            <p className="px-2.5 pb-2 text-[11px] font-medium tracking-wider text-chrome-ink/70 uppercase">
              Workspace
            </p>
            <NavList pathname={pathname} />
          </div>
          <SidebarFooter />
        </aside>

        {/* Mobile top bar + drawer */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-chrome-line bg-chrome px-4 lg:hidden">
          <Brand />
          <RadixDialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <RadixDialog.Trigger
              className="grid size-9 place-items-center rounded-lg text-chrome-ink-strong hover:bg-chrome-raised"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </RadixDialog.Trigger>
            <AnimatePresence>
              {mobileOpen && (
                <RadixDialog.Portal forceMount>
                  <RadixDialog.Overlay asChild forceMount>
                    <motion.div
                      className="fixed inset-0 z-40 bg-black/50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  </RadixDialog.Overlay>
                  <RadixDialog.Content asChild forceMount>
                    <motion.div
                      className="fixed inset-y-0 left-0 z-50 flex w-[78vw] max-w-72 flex-col bg-chrome px-3 py-4 focus:outline-none"
                      initial={{ x: "-100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "-100%" }}
                      transition={{ type: "spring", stiffness: 420, damping: 40 }}
                    >
                      <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
                      <RadixDialog.Description className="sr-only">
                        Main navigation
                      </RadixDialog.Description>
                      <div className="flex items-center justify-between">
                        <Brand />
                        <RadixDialog.Close
                          className="grid size-9 place-items-center rounded-lg text-chrome-ink hover:bg-chrome-raised"
                          aria-label="Close navigation"
                        >
                          <X className="size-5" />
                        </RadixDialog.Close>
                      </div>
                      <div className="mt-6 flex-1">
                        <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                      </div>
                      <SidebarFooter />
                    </motion.div>
                  </RadixDialog.Content>
                </RadixDialog.Portal>
              )}
            </AnimatePresence>
          </RadixDialog.Root>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-[13px] text-ink-muted">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
