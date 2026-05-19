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
