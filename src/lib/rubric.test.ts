import { describe, expect, it } from "vitest";

import {
  chicagoDayCode,
  claimedAtInValidWindow,
  evaluateRubric,
  type RubricInput,
} from "./rubric";

// Helper for building a happy-path input. Tests then override fields to
// trigger specific failures.
function baseInput(overrides: Partial<RubricInput> = {}): RubricInput {
  // 2026-05-19 (Tuesday) 18:30 in America/Chicago = 23:30 UTC same day.
  // We pick a known UTC instant that projects to a Tue dinner hour in CDT.
  // Daylight saving: in May, Chicago is UTC-5.
  return {
    claimedAt: new Date("2026-05-19T23:30:00Z"),
    offerValidStartTime: "17:00:00",
    offerValidEndTime: "22:00:00",
    offerValidDays: ["tue", "wed", "thu"],
    offerMinSpendCents: 1000,
    offerMaxClaimsPerDiner: 1,
    subtotalCents: 4000,
    restaurantMcc: "5812",
    totalDinerClaimsOnOffer: 1,
    cardBelongsToDiner: true,
    ...overrides,
  };
}

describe("evaluateRubric", () => {
  it("passes when everything is in bounds", () => {
    const r = evaluateRubric(baseInput());
    expect(r.passed).toBe(true);
    expect(r.failedChecks).toEqual([]);
  });

  it("flags timing when claim is outside the daily window", () => {
    // 14:00 UTC on the same Tue = 09:00 CDT — before the 17:00 window.
    const r = evaluateRubric(
      baseInput({ claimedAt: new Date("2026-05-19T14:00:00Z") }),
    );
    expect(r.failedChecks).toContain("timing");
  });

  it("flags day when claim is on a non-valid weekday", () => {
    // 2026-05-17 is a Sunday (in Chicago time too).
    const r = evaluateRubric(
      baseInput({ claimedAt: new Date("2026-05-17T23:30:00Z") }),
    );
    expect(r.failedChecks).toContain("day");
  });

  it("flags min_spend when subtotal is below the offer minimum", () => {
    const r = evaluateRubric(
      baseInput({ offerMinSpendCents: 5000, subtotalCents: 1000 }),
    );
    expect(r.failedChecks).toContain("min_spend");
  });

  it("flags mcc for non-restaurant categories", () => {
    const r = evaluateRubric(baseInput({ restaurantMcc: "5814" }));
    expect(r.failedChecks).toContain("mcc");
  });

  it("accepts 5813 (drinking places — wine bars / taverns)", () => {
    const r = evaluateRubric(baseInput({ restaurantMcc: "5813" }));
    expect(r.failedChecks).not.toContain("mcc");
  });

  it("flags max_per_diner when the diner has exceeded their cap", () => {
    const r = evaluateRubric(
      baseInput({ offerMaxClaimsPerDiner: 1, totalDinerClaimsOnOffer: 2 }),
    );
    expect(r.failedChecks).toContain("max_per_diner");
  });

  it("flags card_match when the card doesn't belong to the diner", () => {
    const r = evaluateRubric(baseInput({ cardBelongsToDiner: false }));
    expect(r.failedChecks).toContain("card_match");
  });

  it("accumulates multiple failures", () => {
    const r = evaluateRubric(
      baseInput({
        claimedAt: new Date("2026-05-17T14:00:00Z"), // wrong day AND wrong time
        subtotalCents: 100,                          // below min
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.failedChecks).toEqual(
      expect.arrayContaining(["timing", "day", "min_spend"]),
    );
  });
});

describe("claimedAtInValidWindow", () => {
  it("handles a same-day window", () => {
    // 18:00 CDT = 23:00 UTC on May 19
    expect(
      claimedAtInValidWindow(
        new Date("2026-05-19T23:00:00Z"),
        "17:00",
        "22:00",
      ),
    ).toBe(true);
  });

  it("handles an overnight window crossing midnight", () => {
    // Window 22:00 → 02:00. 01:00 local should pass; 03:00 should fail.
    // 01:00 CDT = 06:00 UTC the same day
    expect(
      claimedAtInValidWindow(
        new Date("2026-05-20T06:00:00Z"),
        "22:00",
        "02:00",
      ),
    ).toBe(true);
    // 03:00 CDT = 08:00 UTC
    expect(
      claimedAtInValidWindow(
        new Date("2026-05-20T08:00:00Z"),
        "22:00",
        "02:00",
      ),
    ).toBe(false);
  });
});

describe("chicagoDayCode", () => {
  it("projects UTC to Chicago day-of-week", () => {
    // 2026-05-19 23:30 UTC = 2026-05-19 18:30 CDT (Tuesday)
    expect(chicagoDayCode(new Date("2026-05-19T23:30:00Z"))).toBe("tue");
  });

  it("respects the timezone boundary", () => {
    // 2026-05-20 02:00 UTC = 2026-05-19 21:00 CDT — still Tuesday.
    expect(chicagoDayCode(new Date("2026-05-20T02:00:00Z"))).toBe("tue");
    // 2026-05-20 06:00 UTC = 2026-05-20 01:00 CDT — Wednesday.
    expect(chicagoDayCode(new Date("2026-05-20T06:00:00Z"))).toBe("wed");
  });
});
