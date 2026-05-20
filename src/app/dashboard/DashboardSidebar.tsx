"use client";

// Merchant dashboard sidebar — dark ink rail with the brand wordmark,
// a venue card, and route-aware nav. Client component for usePathname
// active highlighting; the layout that renders it stays a server
// component (it does requireRole + data fetching).

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/offers", label: "Offers" },
  { href: "/dashboard/claims", label: "Tonight" },
];

export function DashboardSidebar({
  restaurantName,
  displayName,
}: {
  restaurantName: string | null;
  displayName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-ink px-4 py-6 text-cream">
      <Link
        href="/dashboard"
        className="px-2 font-serif text-xl font-medium tracking-tight text-cream"
      >
        Meal<span className="text-orange">Mate</span>
      </Link>

      {restaurantName ? (
        <div className="mx-1 mt-5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-cream/50">
            Venue
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-cream">
            {restaurantName}
          </p>
        </div>
      ) : null}

      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
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
