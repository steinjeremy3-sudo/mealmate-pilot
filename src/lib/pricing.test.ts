import { describe, expect, it } from "vitest";

import { computePrice, PLATFORM_FEE_PCT } from "./pricing";

describe("computePrice", () => {
  it("computes 25% off on a $40 check at 8% fee", () => {
    // subtotal = 4000c, discount = 1000c, payout = 3000c
    // fee = 8% of 4000 = 320c, total = 3000 + 320 = 3320c
    const p = computePrice(4000, 25);
    expect(p.subtotalCents).toBe(4000);
    expect(p.discountCents).toBe(1000);
    expect(p.platformFeeCents).toBe(320);
    expect(p.payoutCents).toBe(3000);
    expect(p.totalCents).toBe(3320);
  });

  it("rounds fractional cents (subtotal not divisible by discount)", () => {
    // 25% of 333c = 83.25c -> 83c
    const p = computePrice(333, 25);
    expect(p.discountCents).toBe(83);
    expect(p.payoutCents).toBe(250);
  });

  it("preserves accounting identity: total = payout + fee", () => {
    for (const sub of [123, 1500, 4737, 99999]) {
      for (const pct of [10, 25, 50, 99]) {
        const p = computePrice(sub, pct);
        expect(p.totalCents).toBe(p.payoutCents + p.platformFeeCents);
        expect(p.subtotalCents).toBe(p.payoutCents + p.discountCents);
      }
    }
  });

  it("uses the documented platform fee", () => {
    expect(PLATFORM_FEE_PCT).toBe(0.08);
  });
});
