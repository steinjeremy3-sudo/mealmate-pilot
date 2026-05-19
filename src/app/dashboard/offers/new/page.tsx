// Merchant: create a new offer.
//
// All offers start as `draft`. The merchant publishes from the offer
// detail page once it looks right.

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { getStripeAccountForRestaurant } from "@/lib/db/stripe-accounts";

import { createOffer } from "./actions";

type SearchParams = Promise<{ error?: string }>;

const DAYS: { value: string; label: string }[] = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);

  if (!restaurant) {
    redirect("/dashboard/onboarding");
  }
  if (restaurant.status !== "approved") {
    redirect("/dashboard?error=approval-required");
  }

  // Gate: restaurant must have a verified Stripe Connect account so
  // MealMate can pull the weekly settlement. Otherwise bounce home and
  // show the "set up payouts" card.
  const stripeAccount = await getStripeAccountForRestaurant(restaurant.id);
  if (!stripeAccount || stripeAccount.status !== "active") {
    redirect("/dashboard?error=stripe-not-active");
  }

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <Link href="/dashboard/offers" className="text-xs text-muted-foreground underline underline-offset-4">
            ← Back to offers
          </Link>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            {restaurant.name}
          </p>
          <h1 className="font-serif text-3xl font-semibold">New offer</h1>
          <p className="text-sm text-muted-foreground">
            New offers are saved as drafts. You&apos;ll see a Publish button
            on the next screen.
          </p>
        </div>

        <form action={createOffer} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Title</span>
            <input
              type="text"
              name="title"
              required
              placeholder="25% off dinner"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Description</span>
            <textarea
              name="description"
              required
              rows={3}
              placeholder="Enjoy 25% off your entire dinner check, Tuesday through Thursday."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Discount (%)</span>
              <input
                type="number"
                name="discount_pct"
                required
                min={15}
                max={50}
                defaultValue={25}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground">15–50%</span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Min check ($)</span>
              <input
                type="number"
                name="min_check"
                step="0.01"
                min={0}
                defaultValue={40}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground">
                Floor that qualifies — typical pilot value $40–$50
              </span>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Monthly budget ($)</span>
            <input
              type="number"
              name="monthly_budget"
              step="0.01"
              min={0}
              defaultValue={2000}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground">
              Cap on total discount spend per month. Offer auto-pauses when
              hit; resets on the 1st.
            </span>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Valid days</legend>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((day) => (
                <label
                  key={day.value}
                  className="flex flex-col items-center gap-1 rounded-md border border-input bg-background px-1 py-2 text-xs cursor-pointer has-checked:border-primary has-checked:bg-secondary/40"
                >
                  <input type="checkbox" name={`day_${day.value}`} className="accent-primary" />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Daily start time</span>
              <input
                type="time"
                name="valid_start_time"
                required
                defaultValue="17:00"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Daily end time</span>
              <input
                type="time"
                name="valid_end_time"
                required
                defaultValue="22:00"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Offer starts</span>
              <input
                type="datetime-local"
                name="starts_at"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Offer ends{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              <input
                type="datetime-local"
                name="ends_at"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save as draft
          </button>
        </form>
      </div>
    </main>
  );
}
