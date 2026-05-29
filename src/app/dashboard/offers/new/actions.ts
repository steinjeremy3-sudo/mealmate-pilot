"use server";

// Server action: a merchant publishes an offer for their (approved)
// restaurant. Goes straight to status='live' — no draft step.
//
// The form only asks the five things that matter (days, time window,
// discount, min check, max redemptions). Title and description are
// auto-generated for downstream displays that still expect them
// (admin queue rows, audit log). Date window: starts now, no end date.
// Monthly budget: set to an effectively-unlimited default since the
// merchant now caps via max_redemptions instead.

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { getStripeAccountForRestaurant } from "@/lib/db/stripe-accounts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseOfferForm } from "@/lib/offers/parse-form";

// Practically-unlimited cap for the (now hidden) monthly_budget_cents
// column — the merchant caps via max_claims_total instead.
const UNLIMITED_BUDGET_CENTS = 1_000_000_000; // $10M

function errParam(message: string): string {
  return `/dashboard/offers/new?error=${encodeURIComponent(message)}`;
}

export async function createOffer(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);

  if (!restaurant) {
    redirect("/dashboard/onboarding");
  }
  if (restaurant.status !== "approved") {
    redirect(errParam("You can only create offers from an approved restaurant."));
  }

  // Same gate as the form page: Stripe Connect must be verified.
  const stripeAccount = await getStripeAccountForRestaurant(restaurant.id);
  if (!stripeAccount || stripeAccount.status !== "active") {
    redirect(errParam("Set up Stripe Connect before creating offers."));
  }

  const parsed = parseOfferForm(formData);
  if (!parsed.ok) {
    redirect(errParam(parsed.error));
  }
  const v = parsed.value;

  // Auto-generated title + description for the downstream displays
  // (admin queue rows, audit log, etc.) that still expect them.
  const title = `${v.discountPct}% off`;
  const description = `${v.discountPct}% off your check at ${restaurant.name}.`;

  // Recurring (default) → open-ended; otherwise ends seven days out so
  // the offer plays its selected days within the coming week, then closes.
  const endsAt = v.recurring
    ? null
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("offers").insert({
    restaurant_id: restaurant.id,
    title,
    description,
    discount_pct: v.discountPct,
    min_check_cents: v.minCheckCents,
    monthly_budget_cents: UNLIMITED_BUDGET_CENTS,
    monthly_spent_cents: 0,
    valid_days: v.validDays,
    valid_start_time: v.validStartTime,
    valid_end_time: v.validEndTime,
    max_claims_per_diner: 1,
    max_claims_total: v.maxRedemptions,
    status: "live",
    starts_at: new Date().toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
  });

  if (error) {
    redirect(errParam(error.message));
  }

  redirect("/dashboard/offers");
}
