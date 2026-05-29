// Stripe Connect return URL. Stripe redirects here after the merchant
// completes (or attempts to complete) the hosted onboarding flow.
//
// We don't trust whatever client-side state Stripe set — the source of
// truth is the account.updated webhook. So this page just tells the
// merchant we're processing; the dashboard will show the real status
// once the webhook updates the mirror.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { buttonVariants, Eyebrow, Heading } from "@/components/brand";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { getStripeAccountForRestaurant } from "@/lib/db/stripe-accounts";

import { refreshStripeAccountStatus } from "../actions";

export default async function StripeOnboardingReturn() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  let account = restaurant
    ? await getStripeAccountForRestaurant(restaurant.id)
    : null;

  // The webhook is the source of truth, but it can lag. Rather than show
  // "Almost there" until it lands, pull fresh state straight from Stripe
  // right now so a merchant who finished onboarding usually sees the real
  // "connected" status immediately on return.
  if (account && account.status !== "active") {
    await refreshStripeAccountStatus(
      account.restaurant_id,
      account.stripe_account_id,
    );
    account = restaurant
      ? await getStripeAccountForRestaurant(restaurant.id)
      : null;
  }

  const isActive = account?.status === "active";

  return (
    <div className="flex flex-1 items-start justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-5 text-center">
        <Eyebrow className="flex justify-center">Stripe Connect</Eyebrow>
        <Heading as="h1" size="page">
          {isActive ? (
            <>
              You&apos;re connected
            </>
          ) : (
            "Almost there"
          )}
        </Heading>
        <p className="text-sm text-muted-foreground">
          {isActive
            ? "Stripe has verified your account. You're ready to create offers for your diners."
            : "Stripe is verifying the details you submitted. This usually takes a few minutes; we'll update your dashboard as soon as your account is active."}
        </p>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
