// Shared validation/parsing for the merchant offer form, used by both
// createOffer (new) and updateOffer (edit) so the two never drift.
//
// Returns parsed, validated values OR a single human-readable error
// message. Persistence, title/description, and ends_at handling stay
// in the actions — this only validates the raw fields the form posts.

import { usdToCents } from "@/lib/money";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// Bounds per BRIEF.md offer constraints (rebate model).
export const DISCOUNT_MIN_PCT = 15;
export const DISCOUNT_MAX_PCT = 50;

// $10 hard floor on min_check_cents. Below this the platform-fee floor
// (50¢) starts eating the discount, so small checks return near-zero.
export const MIN_CHECK_FLOOR_CENTS = 1000; // $10

export type ParsedOfferForm = {
  discountPct: number;
  minCheckCents: number;
  maxRedemptions: number;
  validDays: string[];
  validStartTime: string;
  validEndTime: string;
  /** Recurring weekly (open-ended) vs a single limited run. */
  recurring: boolean;
};

export function parseOfferForm(
  formData: FormData,
): { ok: true; value: ParsedOfferForm } | { ok: false; error: string } {
  // Discount % — 15–50 (DB also enforces a CHECK).
  const discountPct = parseInt(String(formData.get("discount_pct") ?? ""), 10);
  if (
    !Number.isFinite(discountPct) ||
    discountPct < DISCOUNT_MIN_PCT ||
    discountPct > DISCOUNT_MAX_PCT
  ) {
    return {
      ok: false,
      error: `Discount must be between ${DISCOUNT_MIN_PCT} and ${DISCOUNT_MAX_PCT} percent.`,
    };
  }

  // Min check size (dollars → cents).
  const minCheckUsd = parseFloat(String(formData.get("min_check") ?? "0"));
  if (!Number.isFinite(minCheckUsd) || minCheckUsd < 0) {
    return { ok: false, error: "Minimum check size must be a non-negative number." };
  }
  const minCheckCents = usdToCents(minCheckUsd);
  if (minCheckCents < MIN_CHECK_FLOOR_CENTS) {
    return {
      ok: false,
      error: `Minimum check size must be at least $${MIN_CHECK_FLOOR_CENTS / 100} so the platform-fee floor doesn't eat the discount on small visits.`,
    };
  }

  // Max redemptions — total activations across all diners.
  const maxRedemptions = parseInt(
    String(formData.get("max_redemptions") ?? ""),
    10,
  );
  if (!Number.isFinite(maxRedemptions) || maxRedemptions < 1) {
    return { ok: false, error: "Max redemptions must be at least 1." };
  }

  // Valid days (at least one).
  const validDays = DAYS.filter((d) => formData.get(`day_${d}`) === "on");
  if (validDays.length === 0) {
    return { ok: false, error: "Pick at least one day of the week." };
  }

  // Daily time window.
  const validStartTime = String(formData.get("valid_start_time") ?? "");
  const validEndTime = String(formData.get("valid_end_time") ?? "");
  if (
    !/^\d{2}:\d{2}$/.test(validStartTime) ||
    !/^\d{2}:\d{2}$/.test(validEndTime)
  ) {
    return { ok: false, error: "Start and end time are required." };
  }

  const recurring = formData.get("recurring") === "on";

  return {
    ok: true,
    value: {
      discountPct,
      minCheckCents,
      maxRedemptions,
      validDays: [...validDays],
      validStartTime,
      validEndTime,
      recurring,
    },
  };
}
