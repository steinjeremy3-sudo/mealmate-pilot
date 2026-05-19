// Stripe Connect return URL. Stripe redirects here after the merchant
// completes (or attempts to complete) the hosted onboarding flow.
//
// We don't trust whatever client-side state Stripe set — the source of
// truth is the account.updated webhook. So this page just tells the
// merchant we're processing; the dashboard will show the real status
// once the webhook updates the mirror.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { getStripeAccountForRestaurant } from "@/lib/db/stripe-accounts";

export default async function StripeOnboardingReturn() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  const account = restaurant
    ? await getStripeAccountForRestaurant(restaurant.id)
    : null;

  const isActive = account?.status === "active";

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          Stripe Connect
        </p>
        <h1 className="font-serif text-3xl font-semibold">
          {isActive ? "You're connected." : "Almost there."}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isActive
            ? "Stripe has verified your account. You're ready to create offers and collect rebates for your diners."
            : "Stripe is verifying the details you submitted. This usually takes a few minutes; we'll update your dashboard as soon as your account is active."}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
