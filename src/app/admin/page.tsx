// Admin / ops section landing. Phase 1: signed in, no tools yet.

import { requireRole } from "@/lib/auth/require-role";

export default async function AdminHome() {
  const profile = await requireRole("admin");

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          You&apos;re signed in
        </p>
        <h1 className="font-serif text-3xl font-semibold">
          Hi, {profile.displayName}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Merchant approvals and the auto-approval queue arrive in Phase 2.
        </p>
      </div>
    </main>
  );
}
