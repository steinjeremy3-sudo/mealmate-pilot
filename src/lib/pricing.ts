// Single source of truth for offer pricing math. All inputs/outputs in
// integer CENTS — never floats, never USD.

/** Platform fee % charged to the diner on top of the discounted total. */
export const PLATFORM_FEE_PCT = 0.08;

export type PriceBreakdown = {
  subtotalCents: number;     // pre-discount, what the meal would cost
  discountCents: number;     // amount taken off by the offer
  platformFeeCents: number;  // MealMate's cut, paid by the diner
  totalCents: number;        // what the diner pays (subtotal - discount + fee)
  payoutCents: number;       // what the restaurant gets (subtotal - discount)
};

/**
 * Compute the full price breakdown for a payment.
 *
 * Discount and fee are both percentages of subtotal. Standard rounding
 * (Math.round) handles fractional cents.
 */
export function computePrice(
  subtotalCents: number,
  discountPct: number,
): PriceBreakdown {
  const discountCents = Math.round((subtotalCents * discountPct) / 100);
  const payoutCents = subtotalCents - discountCents;
  const platformFeeCents = Math.round(subtotalCents * PLATFORM_FEE_PCT);
  const totalCents = payoutCents + platformFeeCents;
  return {
    subtotalCents,
    discountCents,
    platformFeeCents,
    totalCents,
    payoutCents,
  };
}
