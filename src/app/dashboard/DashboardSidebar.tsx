"use client";

// Merchant dashboard sidebar — the bundle's warm bone rail with the
// wordmark, route-aware nav, and a venue + sign-out footer. Client
// component for usePathname active highlighting; the layout that
// renders it stays a server component (requireRole + data).

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/offers", label: "Offers" },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/claims", label: "Tonight" },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/settlements", label: "Settlements" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/help", label: "Help" },
];

export function DashboardSidebar({
  restaurantName,
  displayName,
  footerSlot,
}: {
  restaurantName: string | null;
  displayName: string;
  /** Server-rendered sign-out button, passed in from the layout. */
  footerSlot?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-bone-deep px-4 py-7">
      <Wordmark href="/dashboard" className="px-3" />

      <nav className="mt-9 flex flex-1 flex-col gap-0.5">
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
                "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-ink text-bone"
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
          {restaurantName ? (
            <p className="truncate font-display text-lg text-ink">
              {restaurantName}
            </p>
          ) : null}
          <p className="truncate text-xs text-muted-foreground">
            {displayName}
          </p>
        </div>
        {footerSlot}
      </div>
    </aside>
  );
}
