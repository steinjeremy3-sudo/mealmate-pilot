// Merchant section layout (/dashboard).
//
// Phase 1: enforces role=merchant. Unauthenticated → /sign-in.
// Wrong role → bounced to their own home (see requireRole).

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { SignOutButton } from "@/components/sign-out-button";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("merchant");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="font-mono text-xs tracking-widest uppercase">
              MealMate · Merchant
            </Link>
            <Link
              href="/dashboard/offers"
              className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              Offers
            </Link>
            <Link
              href="/dashboard/claims"
              className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              Tonight
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {profile.displayName}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex-1 flex">{children}</div>
    </div>
  );
}
