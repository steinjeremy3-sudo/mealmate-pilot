import { describe, expect, it } from "vitest";

import {
  computeFeeCents,
  computeRebate,
  effectiveCashBackPct,
  PLATFORM_FEE_MAX_CENTS,
  PLATFORM_FEE_MIN_CENTS,
  PLATFORM_FEE_RATE,
} from "./pricing";

describe("computeFeeCents (20% of discount, floor + cap)", () => {
  it("uses 20% of the discount when within bounds", () => {
    // $37 discount → 20% = $7.40
    expect(computeFeeCents(3700)).toBe(740);
    // $12.10 discount → 20% = $2.42
    expect(computeFeeCents(1210)).toBe(242);
  });

  it("floors at PLATFORM_FEE_MIN_CENTS", () => {
    // $1.50 discount → 20% = 30¢, floored to 50¢
    expect(computeFeeCents(150)).toBe(50);
    // $0 → still 50¢ floor
    expect(computeFeeCents(0)).toBe(50);
  });

  it("caps at PLATFORM_FEE_MAX_CENTS", () => {
    // $120 discount → 20% = $24, capped at $10
    expect(computeFeeCents(12000)).toBe(1000);
    // $1,000 discount → would be $200, capped at $10
    expect(computeFeeCents(100000)).toBe(1000);
  });
});

describe("computeRebate — mandated fee-change test cases", () => {
  // | check  | d    | discount | fee          | cash back | settlement |
  // | 148.00 | 0.25 | 37.00    | 7.40         | 29.60     | 37.00      |
  // | 55.00  | 0.22 | 12.10    | 2.42         | 9.68      | 12.10      |
  // | 10.00  | 0.15 | 1.50     | 0.50 (floor) | 1.00      | 1.50       |
  // | 400.00 | 0.30 | 120.00   | 10.00 (cap)  | 110.00    | 120.00     |

  it("$148.00 / 25% → fee $7.40, cash back $29.60", () => {
    const r = computeRebate(14800, 25);
    expect(r.totalCents).toBe(14800);
    expect(r.discountCents).toBe(3700); // restaurant settlement
    expect(r.platformFeeCents).toBe(740); // 20% of $37
    expect(r.rebateCents).toBe(2960); // diner cash back
    expect(r.cashBackFloored).toBe(false);
  });

  it("$55.00 / 22% → fee $2.42, cash back $9.68", () => {
    const r = computeRebate(5500, 22);
    expect(r.discountCents).toBe(1210);
    expect(r.platformFeeCents).toBe(242); // 20% of $12.10
    expect(r.rebateCents).toBe(968);
    expect(r.cashBackFloored).toBe(false);
  });

  it("$10.00 / 15% → fee floored to $0.50, cash back $1.00", () => {
    const r = computeRebate(1000, 15);
    expect(r.discountCents).toBe(150);
    expect(r.platformFeeCents).toBe(50); // 20% = 30¢, floored to 50¢
    expect(r.rebateCents).toBe(100);
    expect(r.cashBackFloored).toBe(false);
  });

  it("$400.00 / 30% → fee capped at $10.00, cash back $110.00", () => {
    const r = computeRebate(40000, 30);
    expect(r.discountCents).toBe(12000);
    expect(r.platformFeeCents).toBe(1000); // 20% = $24, capped at $10
    expect(r.rebateCents).toBe(11000);
    expect(r.cashBackFloored).toBe(false);
  });
});

describe("computeRebate — invariants", () => {
  it("restaurant settlement always equals the discount", () => {
    for (const total of [1000, 5500, 14800, 40000, 123456]) {
      for (const pct of [15, 22, 25, 30, 50]) {
        const r = computeRebate(total, pct);
        const expectedDiscount = Math.round((total * pct) / 100);
        // discountCents is what the restaurant settles — unchanged by the fee.
        expect(r.discountCents).toBe(expectedDiscount);
      }
    }
  });

  it("fee stays within [floor, cap] and cash back is never negative", () => {
    for (const total of [100, 1234, 5000, 14800, 50000, 123456]) {
      for (const pct of [15, 20, 25, 30, 40, 50]) {
        const r = computeRebate(total, pct);
        expect(r.platformFeeCents).toBeGreaterThanOrEqual(PLATFORM_FEE_MIN_CENTS);
        expect(r.platformFeeCents).toBeLessThanOrEqual(PLATFORM_FEE_MAX_CENTS);
        expect(r.rebateCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("preserves identity fee + cash back == discount (when not floored)", () => {
    for (const total of [5000, 14800, 50000, 123456]) {
      for (const pct of [15, 20, 25, 30, 40, 50]) {
        const r = computeRebate(total, pct);
        if (!r.cashBackFloored) {
          expect(r.platformFeeCents + r.rebateCents).toBe(r.discountCents);
        }
      }
    }
  });

  it("flags + clamps when the floored fee exceeds a tiny discount", () => {
    // $2.00 check, 15% off → discount 30¢, fee floored to 50¢ > discount.
    const r = computeRebate(200, 15);
    expect(r.discountCents).toBe(30);
    expect(r.platformFeeCents).toBe(50);
    expect(r.rebateCents).toBe(0); // clamped, not −20¢
    expect(r.cashBackFloored).toBe(true);
  });
});

describe("effectiveCashBackPct (diner-facing net rate)", () => {
  it("nets the discount minus our 20% cut of it", () => {
    // A 25% offer nets the diner ~20% of the check.
    expect(effectiveCashBackPct(25)).toBe(20);
    expect(effectiveCashBackPct(30)).toBe(24);
    expect(effectiveCashBackPct(15)).toBe(12);
    expect(effectiveCashBackPct(22)).toBeCloseTo(17.6, 5);
  });

  it("never claims the diner gets the full gross discount", () => {
    for (const pct of [15, 20, 25, 30, 40, 50]) {
      expect(effectiveCashBackPct(pct)).toBeLessThan(pct);
    }
  });
});

describe("env defaults", () => {
  it("matches the new fee-on-discount constants", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.2);
    expect(PLATFORM_FEE_MIN_CENTS).toBe(50);
    expect(PLATFORM_FEE_MAX_CENTS).toBe(1000);
  });
});
