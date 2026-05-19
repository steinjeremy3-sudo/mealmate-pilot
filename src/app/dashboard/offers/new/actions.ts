"use server";

// Server action: a merchant creates an offer for their (approved)
// restaurant. status starts as 'draft' — they publish from the offer
// detail page.

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { usdToCents } from "@/lib/money";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// Bounds per BRIEF.md offer constraints (rebate model).
const DISCOUNT_MIN_PCT = 15;
const DISCOUNT_MAX_PCT = 50;

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

  // Required strings
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) redirect(errParam("Title is required."));
  if (!description) redirect(errParam("Description is required."));

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

  // Monthly budget cap (dollars → cents). Auto-pause when exhausted.
  const monthlyBudgetUsd = parseFloat(
    String(formData.get("monthly_budget") ?? "0"),
  );
  if (!Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd < 0) {
    redirect(errParam("Monthly budget must be a non-negative number."));
  }
  const monthlyBudgetCents = usdToCents(monthlyBudgetUsd);

  // Valid days (multi-checkbox: at least one)
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

  // Overall window (start required, end optional)
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  if (!startsAtRaw) redirect(errParam("Start date is required."));
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) redirect(errParam("Start date is invalid."));

  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();
  let endsAt: Date | null = null;
  if (endsAtRaw) {
    endsAt = new Date(endsAtRaw);
    if (Number.isNaN(endsAt.getTime())) redirect(errParam("End date is invalid."));
    if (endsAt <= startsAt) redirect(errParam("End date must be after start date."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("offers").insert({
    restaurant_id: restaurant.id,
    title,
    description,
    discount_pct: discountPct,
    min_check_cents: minCheckCents,
    monthly_budget_cents: monthlyBudgetCents,
    monthly_spent_cents: 0,
    valid_days: validDays,
    valid_start_time: validStartTime,
    valid_end_time: validEndTime,
    max_claims_per_diner: 1,
    status: "draft",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
  });

  if (error) {
    redirect(errParam(error.message));
  }

  redirect("/dashboard/offers");
}
