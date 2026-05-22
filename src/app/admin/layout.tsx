// Admin / ops section layout (/admin).
//
// Phase 1: enforces role=admin. Unauthenticated → /sign-in.
// Wrong role → bounced to their own home.
//
// Admin accounts are created by hand in the Supabase dashboard (no web
// sign-up path) — see scripts/auth-setup.sql and BRIEF.md.

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
      <AdminSidebar
        displayName={profile.displayName}
        footerSlot={<SignOutButton className="w-full" />}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
