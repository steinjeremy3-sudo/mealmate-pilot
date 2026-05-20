// Admin / ops section layout (/admin).
//
// Phase 1: enforces role=admin. Unauthenticated → /sign-in.
// Wrong role → bounced to their own home.
//
// Admin accounts are created by hand in the Supabase dashboard (no web
// sign-up path) — see scripts/auth-setup.sql and BRIEF.md.
//
// Visual reference: design-reference/ops.html.

import { requireRole } from "@/lib/auth/require-role";
import { SignOutButton } from "@/components/sign-out-button";

import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("admin");

  return (
    <div className="flex flex-1 bg-background">
      <AdminSidebar displayName={profile.displayName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-cream-soft px-6 py-3">
          <SignOutButton />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
