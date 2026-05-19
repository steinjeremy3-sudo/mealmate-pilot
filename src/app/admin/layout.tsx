// Admin / ops section layout (/admin).
//
// Phase 1: enforces role=admin. Unauthenticated → /sign-in.
// Wrong role → bounced to their own home.
//
// Admin accounts are created by hand in the Supabase dashboard (no web
// sign-up path) — see scripts/auth-setup.sql and BRIEF.md.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("admin");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="font-mono text-xs tracking-widest uppercase">
              MealMate · Ops
            </Link>
            <Link
              href="/admin/matches"
              className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              Matches
            </Link>
            <Link
              href="/admin/rebates"
              className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              Rebates
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
