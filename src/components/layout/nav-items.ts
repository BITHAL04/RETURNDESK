import { Inbox, LayoutDashboard, Plus } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "All requests", icon: Inbox },
  { href: "/requests/new", label: "New request", icon: Plus },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/requests")
    return pathname === "/requests" || /^\/requests\/(?!new)[^/]+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}
