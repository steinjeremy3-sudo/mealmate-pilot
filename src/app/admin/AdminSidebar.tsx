"use client";

// Ops console sidebar — the bundle's warm cream rail with the
// lowercase wordmark + OPS badge and route-aware nav. Client component
// for usePathname; the layout stays a server component (requireRole).

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/matches", label: "Visits" },
  { href: "/admin/rebates", label: "Cash back" },
  { href: "/admin/settlements", label: "Settlements" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminSidebar({
  displayName,
  footerSlot,
}: {
  displayName: string;
  footerSlot?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-cream-warm px-4 py-7">
      <Link href="/admin" className="flex items-center gap-2 px-3">
        <span className="font-serif text-[26px] font-medium italic tracking-tight text-orange">
          mealmate
        </span>
        <span className="rounded bg-orange-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-orange-deep">
          Ops
        </span>
      </Link>

      <nav className="mt-9 flex flex-1 flex-col gap-0.5">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-ink text-cream"
                  : "text-ink-soft hover:bg-ink/5",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-border pt-4">
        <div className="px-1">
          <p className="truncate font-serif text-lg text-ink">{displayName}</p>
          <p className="text-xs text-muted-foreground">Operations</p>
        </div>
        {footerSlot}
      </div>
    </aside>
  );
}
