// Rebate-model pricing. Diner pays the full check at the POS — MealMate
// only sees the transaction after Plaid surfaces it. We then compute
// the rebate that gets pushed back to the diner's card via Visa Direct.
//
// All math in integer CENTS — never floats, never USD.
//
// Constants are env-driven so the fee can be tuned post-launch without
// a redeploy.

/** 6% of total — `env.PLATFORM_FEE_PERCENT_OF_TOTAL` (LOCKED, see BRIEF.md). */
export const PLATFORM_FEE_PERCENT_OF_TOTAL = Number(
  process.env.PLATFORM_FEE_PERCENT_OF_TOTAL ?? "0.06",
);

/** Floor in cents — `env.PLATFORM_FEE_MIN_CENTS` (default $0.50). */
export const PLATFORM_FEE_MIN_CENTS = Number(
  process.env.PLATFORM_FEE_MIN_CENTS ?? "50",
);

/** Cap in cents — `env.PLATFORM_FEE_MAX_CENTS` (default $10.00). */
export const PLATFORM_FEE_MAX_CENTS = Number(
  process.env.PLATFORM_FEE_MAX_CENTS ?? "1000",
);

export type RebateBreakdown = {
  /** Total check the diner paid at the POS (post-tax, in cents). */
  totalCents: number;
  /** Discount the offer entitles them to (% of total, rounded). */
  discountCents: number;
  /** MealMate's cut, after applying the min/max bounds. */
  platformFeeCents: number;
  /** Net rebate pushed to the diner's card via Visa Direct. */
  rebateCents: number;
};

/**
 * Compute fee given a total check, applying the floor/cap.
 *
 * Formula:
 *   fee = clamp(total * PERCENT, MIN, MAX)
 */
export function computeFeeCents(totalCents: number): number {
  const raw = Math.round(totalCents * PLATFORM_FEE_PERCENT_OF_TOTAL);
  return Math.max(PLATFORM_FEE_MIN_CENTS, Math.min(PLATFORM_FEE_MAX_CENTS, raw));
}

/**
 * Compute the full rebate breakdown for a matched transaction.
 *
 *   discount = total * discount_pct / 100
 *   fee      = clamp(total * 0.06, 50, 1000)
 *   rebate   = discount − fee
 */
export function computeRebate(
  totalCents: number,
  discountPct: number,
): RebateBreakdown {
  const discountCents = Math.round((totalCents * discountPct) / 100);
  const platformFeeCents = computeFeeCents(totalCents);
  const rebateCents = discountCents - platformFeeCents;
  return {
    totalCents,
    discountCents,
    platformFeeCents,
    rebateCents,
  };
}
