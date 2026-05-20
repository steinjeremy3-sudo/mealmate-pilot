// Diner section layout (/app).
//
// Mobile-first: this is what diners use on their phones (or in any browser).
// Phase 1: enforces role=diner. Unauthenticated -> /sign-in. Wrong role ->
// bounced to their own home.
//
// Visual reference: design-reference/consumer.html (warm/editorial system).

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DinerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("diner");

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border bg-cream-soft">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-5">
            <Link
              href="/app"
              className="font-serif text-lg font-medium tracking-tight text-foreground"
            >
              Meal<span className="text-orange">Mate</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/app/claims"
                className="text-sm text-muted-foreground transition-colors hover:text-orange"
              >
                Claims
              </Link>
              <Link
                href="/app/cards"
                className="text-sm text-muted-foreground transition-colors hover:text-orange"
              >
                Cards
              </Link>
              <Link
                href="/app/rebates/setup"
                className="text-sm text-muted-foreground transition-colors hover:text-orange"
              >
                Rebates
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {profile.displayName}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex flex-1">{children}</div>
    </div>
  );
}
