"use client";

// Ops dashboard sidebar — dark ink rail, route-aware nav. Mirrors the
// merchant DashboardSidebar; the layout that renders it stays a server
// component (requireRole).

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/rebates", label: "Rebates" },
  { href: "/admin/settlements", label: "Settlements" },
];

export function AdminSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-ink px-4 py-6 text-cream">
      <Link href="/admin" className="flex items-baseline gap-2 px-2">
        <span className="font-serif text-xl font-medium tracking-tight text-cream">
          Meal<span className="text-orange">Mate</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-cream/40">
          Ops
        </span>
      </Link>

      <nav className="mt-7 flex flex-col gap-1">
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
                "rounded-lg px-3.5 py-2.5 text-sm transition-colors",
                active
                  ? "bg-orange/15 font-medium text-cream"
                  : "text-cream/65 hover:bg-white/5 hover:text-cream",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 pt-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange text-sm font-semibold text-white">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-xs text-cream/70">{displayName}</span>
      </div>
    </aside>
  );
}
