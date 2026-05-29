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
import { usdToCents } from "@/lib/money";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// Bounds per BRIEF.md offer constraints (rebate model).
const DISCOUNT_MIN_PCT = 15;
const DISCOUNT_MAX_PCT = 50;

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

  // Discount % — 15–50 per BRIEF.md (DB also enforces CHECK).
  const discountPct = parseInt(String(formData.get("discount_pct") ?? ""), 10);
  if (
    !Number.isFinite(discountPct) ||
    discountPct < DISCOUNT_MIN_PCT ||
    discountPct > DISCOUNT_MAX_PCT
  ) {
    redirect(
      errParam(
        `Discount must be between ${DISCOUNT_MIN_PCT} and ${DISCOUNT_MAX_PCT} percent.`,
      ),
    );
  }

  // Min check size (dollars → cents). Floor the offer applies to.
  const minCheckUsd = parseFloat(String(formData.get("min_check") ?? "0"));
  if (!Number.isFinite(minCheckUsd) || minCheckUsd < 0) {
    redirect(errParam("Minimum check size must be a non-negative number."));
  }
  const minCheckCents = usdToCents(minCheckUsd);

  // Max redemptions — total activations across all diners. When this
  // count is hit, the offer reads as "fully booked" in claimOffer.
  const maxRedemptions = parseInt(
    String(formData.get("max_redemptions") ?? ""),
    10,
  );
  if (!Number.isFinite(maxRedemptions) || maxRedemptions < 1) {
    redirect(errParam("Max redemptions must be at least 1."));
  }

  // Valid days (at least one)
  const validDays = DAYS.filter((d) => formData.get(`day_${d}`) === "on");
  if (validDays.length === 0) {
    redirect(errParam("Pick at least one day of the week."));
  }

  // Daily time window
  const validStartTime = String(formData.get("valid_start_time") ?? "");
  const validEndTime = String(formData.get("valid_end_time") ?? "");
  if (!/^\d{2}:\d{2}$/.test(validStartTime) || !/^\d{2}:\d{2}$/.test(validEndTime)) {
    redirect(errParam("Start and end time are required."));
  }

  // Auto-generated title + description for the downstream displays
  // (admin queue rows, audit log, etc.) that still expect them.
  const title = `${discountPct}% off`;
  const description = `${discountPct}% off your check at ${restaurant.name}.`;

  // Recurring checkbox. Checked (default) → open-ended; unchecked →
  // ends seven days from now, so the offer plays out its selected
  // days within the coming week and then closes.
  const recurring = formData.get("recurring") === "on";
  const endsAt = recurring
    ? null
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("offers").insert({
    restaurant_id: restaurant.id,
    title,
    description,
    discount_pct: discountPct,
    min_check_cents: minCheckCents,
    monthly_budget_cents: UNLIMITED_BUDGET_CENTS,
    monthly_spent_cents: 0,
    valid_days: validDays,
    valid_start_time: validStartTime,
    valid_end_time: validEndTime,
    max_claims_per_diner: 1,
    max_claims_total: maxRedemptions,
    status: "live",
    starts_at: new Date().toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
  });

  if (error) {
    redirect(errParam(error.message));
  }

  redirect("/dashboard/offers");
}
