"use client";

// Diner app bottom tab bar — the prototype's 5-tab shell. Fixed to the
// bottom of the phone-width column. Client component for usePathname
// active highlighting.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, MapPin, Wallet, User } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/app",
    label: "Home",
    Icon: Home,
    match: (p: string) => p === "/app" || p.startsWith("/app/offers"),
  },
  {
    href: "/app/search",
    label: "Search",
    Icon: Search,
    match: (p: string) => p.startsWith("/app/search"),
  },
  {
    href: "/app/map",
    label: "Map",
    Icon: MapPin,
    match: (p: string) => p.startsWith("/app/map"),
  },
  {
    href: "/app/wallet",
    label: "Wallet",
    Icon: Wallet,
    match: (p: string) =>
      p.startsWith("/app/wallet") ||
      p.startsWith("/app/claims") ||
      p.startsWith("/app/rebates") ||
      p.startsWith("/app/savings"),
  },
  {
    href: "/app/profile",
    label: "Profile",
    Icon: User,
    match: (p: string) =>
      p.startsWith("/app/profile") || p.startsWith("/app/cards"),
  },
];

export function DinerBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-border bg-bone/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <ul className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "text-paprika"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.Icon className="size-5" strokeWidth={1.75} />
                <span className="text-[10px] font-medium tracking-wide">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
