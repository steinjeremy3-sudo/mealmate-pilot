// Diner section home. Phase 1 stub: signed in, no offers to browse yet.
// Offer browse / claim / pay arrive in Phase 2+.

import { requireRole } from "@/lib/auth/require-role";

export default async function DinerHome() {
  const profile = await requireRole("diner");

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
          Browsing offers, claiming, and pay-in-app arrive in Phase 2.
        </p>
      </div>
    </main>
  );
}
