// Merchant onboarding: create your restaurant.
//
// Hit when the merchant signs in for the first time (or any time they
// have no restaurant row yet). After they submit, status='pending' and
// they wait for the ops team to approve from /admin.

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { createRestaurant } from "./actions";

type SearchParams = Promise<{ error?: string }>;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole("merchant");

  // Already onboarded → bounce home.
  const existing = await getRestaurantForOwner(profile.id);
  if (existing) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = params.error;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Welcome, {profile.displayName}
          </p>
          <h1 className="font-serif text-3xl font-semibold">
            Tell us about your restaurant.
          </h1>
          <p className="text-sm text-muted-foreground">
            Once submitted, our team reviews and approves new restaurants
            within a business day. You&apos;ll be able to create offers once
            you&apos;re approved.
          </p>
        </div>

        <form action={createRestaurant} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Restaurant name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Lucia"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Street address</span>
            <input
              type="text"
              name="address"
              required
              placeholder="408 N Bishop Ave"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Neighborhood</span>
            <select
              name="neighborhood"
              required
              defaultValue=""
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>
                Pick one…
              </option>
              <option value="Bishop Arts">Bishop Arts</option>
              <option value="Knox-Henderson">Knox-Henderson</option>
              <option value="Deep Ellum">Deep Ellum</option>
              <option value="Lower Greenville">Lower Greenville</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Cuisine</span>
            <input
              type="text"
              name="cuisine"
              required
              placeholder="Italian"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Submit for review
          </button>
        </form>

        <p className="text-xs text-muted-foreground">
          City is pre-filled to Dallas, TX. Merchant category code is
          pre-filled for sit-down restaurants (5812).
        </p>
      </div>
    </main>
  );
}
