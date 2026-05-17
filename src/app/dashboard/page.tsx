// Merchant section landing. Phase 1: you're signed in, but the real
// merchant tools (restaurant onboarding, offer creation, redemption
// tracking) arrive in Phase 2+.

import { requireRole } from "@/lib/auth/require-role";

export default async function MerchantHome() {
  // Layout already calls requireRole — this is duplicative but harmless,
  // and it gives us the displayName here without prop-drilling.
  const profile = await requireRole("merchant");

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          You&apos;re signed in
        </p>
        <h1 className="font-serif text-3xl font-semibold">
          Welcome, {profile.displayName}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Restaurant onboarding and offer creation arrive in Phase 2.
        </p>
      </div>
    </main>
  );
}
