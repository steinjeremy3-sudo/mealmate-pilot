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

  // Discount % (1–99, integer)
  const discountPct = parseInt(String(formData.get("discount_pct") ?? ""), 10);
  if (!Number.isFinite(discountPct) || discountPct < 1 || discountPct > 99) {
    redirect(errParam("Discount must be between 1 and 99 percent."));
  }

  // Min spend (dollars → cents)
  const minSpendUsd = parseFloat(String(formData.get("min_spend") ?? "0"));
  if (!Number.isFinite(minSpendUsd) || minSpendUsd < 0) {
    redirect(errParam("Minimum spend must be a non-negative number."));
  }
  const minSpendCents = usdToCents(minSpendUsd);

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
    min_spend_cents: minSpendCents,
    valid_days: validDays,
    // Postgres time columns accept "HH:MM" and pad to "HH:MM:00".
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
