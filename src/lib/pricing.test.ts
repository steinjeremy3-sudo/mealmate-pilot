import { describe, expect, it } from "vitest";

import {
  computeFeeCents,
  computeRebate,
  PLATFORM_FEE_MAX_CENTS,
  PLATFORM_FEE_MIN_CENTS,
  PLATFORM_FEE_PERCENT_OF_TOTAL,
} from "./pricing";

describe("computeFeeCents (floor + cap)", () => {
  it("uses the percent of total when within bounds", () => {
    // $148 → 6% = $8.88
    expect(computeFeeCents(14800)).toBe(888);
    // $50 → 6% = $3.00
    expect(computeFeeCents(5000)).toBe(300);
  });

  it("floors at PLATFORM_FEE_MIN_CENTS", () => {
    // $5 check → 6% = 30¢, floored to 50¢
    expect(computeFeeCents(500)).toBe(50);
    // $0 → still 50¢ floor
    expect(computeFeeCents(0)).toBe(50);
  });

  it("caps at PLATFORM_FEE_MAX_CENTS", () => {
    // $500 → 6% = $30, capped at $10
    expect(computeFeeCents(50000)).toBe(1000);
    // $5,000 → would be $300, capped at $10
    expect(computeFeeCents(500000)).toBe(1000);
  });
});

describe("computeRebate", () => {
  it("matches the BRIEF.md sample: $148 / 25%", () => {
    const r = computeRebate(14800, 25);
    expect(r.totalCents).toBe(14800);
    expect(r.discountCents).toBe(3700);     // $37
    expect(r.platformFeeCents).toBe(888);   // $8.88
    expect(r.rebateCents).toBe(2812);       // $28.12
  });

  it("matches the BRIEF.md sample: $50 / 15%", () => {
    const r = computeRebate(5000, 15);
    expect(r.discountCents).toBe(750);      // $7.50
    expect(r.platformFeeCents).toBe(300);   // $3.00
    expect(r.rebateCents).toBe(450);        // $4.50
  });

  it("handles the cap case: $500 / 20%", () => {
    const r = computeRebate(50000, 20);
    expect(r.discountCents).toBe(10000);    // $100
    expect(r.platformFeeCents).toBe(1000);  // capped at $10
    expect(r.rebateCents).toBe(9000);       // $90
  });

  it("handles the floor case: tiny check", () => {
    // $5 check, 25% off — raw fee is 7.5¢ but min is 50¢.
    const r = computeRebate(500, 25);
    expect(r.discountCents).toBe(125);      // $1.25
    expect(r.platformFeeCents).toBe(50);    // floored
    expect(r.rebateCents).toBe(75);         // $0.75
  });

  it("preserves identity: rebate = discount - fee", () => {
    for (const total of [100, 1234, 5000, 14800, 50000, 123456]) {
      for (const pct of [15, 20, 25, 30, 40, 50]) {
        const r = computeRebate(total, pct);
        expect(r.rebateCents).toBe(r.discountCents - r.platformFeeCents);
      }
    }
  });
});

describe("env defaults", () => {
  it("matches the locked-in BRIEF.md constants", () => {
    expect(PLATFORM_FEE_PERCENT_OF_TOTAL).toBe(0.06);
    expect(PLATFORM_FEE_MIN_CENTS).toBe(50);
    expect(PLATFORM_FEE_MAX_CENTS).toBe(1000);
  });
});
