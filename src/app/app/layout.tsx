// Diner section layout (/app).
//
// Mobile-first: this is what diners use on their phones (or in any browser).
// Phase 1: enforces role=diner. Unauthenticated -> /sign-in. Wrong role ->
// bounced to their own home.
//
// Visual reference for the eventual full diner experience:
// https://mealmate-jet.vercel.app (Bishop Arts-focused static prototype).

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
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-md flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5">
            <Link href="/app" className="font-mono text-xs tracking-widest uppercase">
              MealMate
            </Link>
            <Link
              href="/app/claims"
              className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              Claims
            </Link>
            <Link
              href="/app/cards"
              className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              Cards
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
