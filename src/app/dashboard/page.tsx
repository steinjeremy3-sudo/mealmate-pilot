// Merchant dashboard home. Phase 2a: shows the merchant's restaurant
// with its current status. If no restaurant yet, redirects to the
// onboarding flow.
//
// Phase 2b will add the offers list / creation flow once we know the
// merchant has an approved restaurant.

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getMerchantPayoutSummary } from "@/lib/db/payments";
import { getRestaurantForOwner, type RestaurantStatus } from "@/lib/db/restaurants";
import { centsToUsd } from "@/lib/money";

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

export default async function MerchantHome() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);

  if (!restaurant) {
    redirect("/dashboard/onboarding");
  }

  // Payout summary lives next to the restaurant card. Empty for new
  // merchants — only meaningful once they have approved payments.
  const payouts = await getMerchantPayoutSummary();

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        {/* ===== Payout summary ===== */}
        {restaurant.status === "approved" ? (
          <div className="rounded-lg border border-border p-6 space-y-4 bg-secondary/30">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                  Pending payout
                </p>
                <p className="font-serif text-3xl font-semibold">
                  {centsToUsd(payouts.pendingPayoutCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {payouts.pendingPaymentCount} payment
                  {payouts.pendingPaymentCount === 1 ? "" : "s"} waiting for ACH
                </p>
              </div>
              <div>
                <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                  Paid out
                </p>
                <p className="font-serif text-3xl font-semibold">
                  {centsToUsd(payouts.paidOutPayoutCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {payouts.paidOutPaymentCount} payment
                  {payouts.paidOutPaymentCount === 1 ? "" : "s"} settled
                </p>
              </div>
            </div>
            {payouts.flaggedPaymentCount > 0 ? (
              <p className="text-xs text-muted-foreground border-t pt-3">
                Plus {centsToUsd(payouts.flaggedPayoutCents)} from{" "}
                {payouts.flaggedPaymentCount} flagged payment
                {payouts.flaggedPaymentCount === 1 ? "" : "s"} waiting on
                admin review.
              </p>
            ) : null}
          </div>
        ) : null}

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
              business day. You&apos;ll be able to create offers once approved.
            </p>
          ) : null}

          {restaurant.status === "approved" ? (
            <div className="border-t pt-4">
              <Link
                href="/dashboard/offers"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Manage offers →
              </Link>
            </div>
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
      </div>
    </main>
  );
}
