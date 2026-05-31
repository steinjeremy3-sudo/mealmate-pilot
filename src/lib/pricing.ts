// Rebate-model pricing. Diner pays the full check at the POS — Mealmate
// only sees the transaction after Plaid surfaces it. We then compute
// the cash back that gets pushed back to the diner's card via Visa Direct.
//
// All math in integer CENTS — never floats, never USD.
//
// ── Fee model (changed 2026-05-30) ──────────────────────────────────
// The platform fee used to be 6% of the DISCOUNTED CHECK (what the diner
// paid net of the discount). It is now 20% of the DISCOUNT ITSELF — the
// pool the restaurant funds. The restaurant's cost is unchanged: they
// still settle the full discount. Mealmate's fee comes out of that
// discount, and the diner keeps the rest as cash back.
//
//   discount_amount       = check * discount_pct        // restaurant funds this
//   platform_fee          = clamp(discount_amount * 0.20, FLOOR, CAP)
//   diner_cash_back        = discount_amount − platform_fee   (never < 0)
//   restaurant_settlement = discount_amount              // UNCHANGED
//
// Constants are env-driven so the fee can be tuned post-launch without
// a redeploy. This module is the single source of truth — every caller
// (approve flow, admin display) goes through computeRebate.

/** Mealmate's share of the discount — `env.PLATFORM_FEE_RATE` (default 20%). */
export const PLATFORM_FEE_RATE = Number(
  process.env.PLATFORM_FEE_RATE ?? "0.20",
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
  /** Discount the offer entitles them to (% of total, rounded). This is
   *  also the restaurant's settlement amount — they fund the full pool. */
  discountCents: number;
  /** Mealmate's cut, after applying the min/max bounds. */
  platformFeeCents: number;
  /** Net cash back pushed to the diner's card via Visa Direct. Never < 0. */
  rebateCents: number;
  /** True when the fee floor exceeded the discount, so cash back was
   *  clamped to 0 (the diner gets nothing on a tiny discount). Surfaced
   *  for ops — in this edge case fee + cash back no longer equals the
   *  discount, because the floored fee is larger than the whole pool. */
  cashBackFloored: boolean;
};

/**
 * Apply the percent + clamp to an arbitrary amount.
 *
 * Formula:
 *   fee = clamp(amount * PLATFORM_FEE_RATE, MIN, MAX)
 *
 * Pass the DISCOUNT amount — the fee is now a share of the discount, not
 * of the (discounted) check.
 */
export function computeFeeCents(discountCents: number): number {
  const raw = Math.round(discountCents * PLATFORM_FEE_RATE);
  return Math.max(PLATFORM_FEE_MIN_CENTS, Math.min(PLATFORM_FEE_MAX_CENTS, raw));
}

/**
 * Compute the full breakdown for a matched transaction.
 *
 *   discount = total * discount_pct / 100
 *   fee      = clamp(discount * 0.20, 50, 1000)
 *   rebate   = max(0, discount − fee)
 *
 * The platform fee is taken on the DISCOUNT — the pool the restaurant
 * funds — not the discounted check. The restaurant still settles the
 * full `discountCents`; the fee comes out of the diner's share.
 *
 * @param totalCents  pre-tax check size, in cents
 * @param discountPct activated offer rate as a whole number (e.g. 25 = 25%)
 */
export function computeRebate(
  totalCents: number,
  discountPct: number,
): RebateBreakdown {
  const discountCents = Math.round((totalCents * discountPct) / 100);
  const platformFeeCents = computeFeeCents(discountCents);
  const rawRebateCents = discountCents - platformFeeCents;
  // Cash back must never go negative. On a tiny discount the floored fee
  // can exceed the whole discount; clamp to 0 and flag it for ops.
  const cashBackFloored = rawRebateCents < 0;
  const rebateCents = cashBackFloored ? 0 : rawRebateCents;
  return {
    totalCents,
    discountCents,
    platformFeeCents,
    rebateCents,
    cashBackFloored,
  };
}
