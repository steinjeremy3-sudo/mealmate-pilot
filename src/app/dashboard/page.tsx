// Merchant dashboard home. Shows the merchant's restaurant + status.
// If no restaurant yet, redirects to the onboarding flow.
//
// The Phase 3.5 "Pending payout" / "Paid out" card was removed when we
// switched to the rebate model — the direction inverted (restaurants
// owe MealMate, not vice versa). Phase 4e will reintroduce a weekly
// settlement summary card pointing the other way.

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantForOwner, type RestaurantStatus } from "@/lib/db/restaurants";
import {
  getStripeAccountForRestaurant,
  type StripeAccountStatus,
} from "@/lib/db/stripe-accounts";

import {
  refreshStripeAccountStatus,
  startStripeOnboarding,
} from "./onboarding/stripe/actions";

function StatusBadge({ status }: { status: RestaurantStatus }) {
  const styles: Record<RestaurantStatus, string> = {
    pending: "bg-yellow-100 text-yellow-900 border-yellow-200",
    approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
    suspended: "bg-red-100 text-red-900 border-red-200",
  };
  const label: Record<RestaurantStatus, string> = {
    pending: "Pending approval",
    approved: "Approved",
    suspended: "Suspended",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        styles[status]
      }
    >
      {label[status]}
    </span>
  );
}

function StripeStatusBadge({ status }: { status: StripeAccountStatus }) {
  const styles: Record<StripeAccountStatus, string> = {
    pending: "bg-yellow-100 text-yellow-900 border-yellow-200",
    restricted: "bg-amber-100 text-amber-900 border-amber-200",
    active: "bg-emerald-100 text-emerald-900 border-emerald-200",
  };
  const label: Record<StripeAccountStatus, string> = {
    pending: "Setup in progress",
    restricted: "Stripe review",
    active: "Connected",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        styles[status]
      }
    >
      {label[status]}
    </span>
  );
}

export default async function MerchantHome() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);

  if (!restaurant) {
    redirect("/dashboard/onboarding");
  }

  let stripeAccount =
    restaurant.status === "approved"
      ? await getStripeAccountForRestaurant(restaurant.id)
      : null;

  // Self-heal stale mirrors: if a webhook delivery was missed (the
  // subscription was added after onboarding finished, or the event
  // bounced), pull fresh state directly from Stripe.
  if (stripeAccount && stripeAccount.status !== "active") {
    await refreshStripeAccountStatus(
      stripeAccount.restaurant_id,
      stripeAccount.stripe_account_id,
    );
    stripeAccount = await getStripeAccountForRestaurant(restaurant.id);
  }

  const canCreateOffers =
    restaurant.status === "approved" && stripeAccount?.status === "active";

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          Your restaurant
        </p>

        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-semibold">
                {restaurant.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {restaurant.cuisine} · {restaurant.neighborhood}, {restaurant.city}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {restaurant.address}
              </p>
            </div>
            <StatusBadge status={restaurant.status} />
          </div>

          {restaurant.status === "pending" ? (
            <p className="text-sm text-muted-foreground border-t pt-4">
              The MealMate team typically approves new restaurants within a
              business day. You&apos;ll be able to set up payouts and create
              offers once approved.
            </p>
          ) : null}

          {restaurant.status === "suspended" ? (
            <p className="text-sm text-muted-foreground border-t pt-4">
              Your restaurant is currently suspended. Reach out to{" "}
              <Link href="mailto:ops@mealmate.co" className="underline">
                ops@mealmate.co
              </Link>{" "}
              for help.
            </p>
          ) : null}
        </div>

        {/* ===== Stripe Connect (Phase 4a) ===== */}
        {restaurant.status === "approved" ? (
          <div className="rounded-lg border border-border p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                  Payouts via Stripe
                </p>
                <h2 className="font-serif text-xl font-semibold">
                  {stripeAccount?.status === "active"
                    ? "You're set up."
                    : stripeAccount
                      ? "Finish setup"
                      : "Set up payouts"}
                </h2>
              </div>
              {stripeAccount ? <StripeStatusBadge status={stripeAccount.status} /> : null}
            </div>

            {!stripeAccount ? (
              <>
                <p className="text-sm text-muted-foreground">
                  We collect bank details and KYC through Stripe so MealMate
                  can settle the weekly discount invoice with you. Takes
                  about 5 minutes.
                </p>
                <form action={startStripeOnboarding}>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Continue on Stripe →
                  </button>
                </form>
              </>
            ) : stripeAccount.status === "active" ? (
              <p className="text-sm text-muted-foreground">
                Your Stripe Connect account is verified. Weekly settlement
                invoices will be pulled from the bank account you registered.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Stripe is reviewing the information you submitted. If you
                  need to update it, continue on Stripe.
                </p>
                <form action={startStripeOnboarding}>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
                  >
                    Continue on Stripe →
                  </button>
                </form>
              </>
            )}
          </div>
        ) : null}

        {/* ===== Manage offers (gated on payouts_enabled) ===== */}
        {restaurant.status === "approved" ? (
          <div className="rounded-lg border border-border p-6 space-y-3">
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Offers
            </p>
            {canCreateOffers ? (
              <Link
                href="/dashboard/offers"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Manage offers →
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can create offers once your Stripe Connect account is
                verified above.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
