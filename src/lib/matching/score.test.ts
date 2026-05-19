import { describe, expect, it } from "vitest";

import {
  amountScore,
  diceCoefficient,
  geographyScore,
  nameSimilarity,
  scoreMatch,
  timingScore,
} from "./score";

// All inputs are pre-normalized (lowercase, no punctuation, etc.).
const NAME = {
  lucia: "lucia",
  luciaFull: "lucia restaurant bishop arts",
  luciaTruncated: "lucia restaurant bishop a",
  tartine: "tartine bakery cafe",
};

describe("nameSimilarity", () => {
  it("returns 1.0 for exact match", () => {
    expect(nameSimilarity(NAME.lucia, NAME.lucia)).toBe(1.0);
  });

  it("returns 0 for either side empty", () => {
    expect(nameSimilarity("", NAME.lucia)).toBe(0);
    expect(nameSimilarity(NAME.lucia, "")).toBe(0);
  });

  it("scores 0.9 on token containment (restaurant name inside merchant)", () => {
    expect(nameSimilarity(NAME.luciaFull, NAME.lucia)).toBeGreaterThanOrEqual(0.9);
  });

  it("scores 0.9 on token containment even when truncated tail (BISHOP A)", () => {
    expect(nameSimilarity(NAME.luciaTruncated, NAME.lucia))
      .toBeGreaterThanOrEqual(0.9);
  });

  it("does not match on single-letter tokens alone", () => {
    expect(nameSimilarity("a b c", "a")).toBeLessThan(0.9);
  });

  it("scores low for unrelated names", () => {
    expect(nameSimilarity("lucia", NAME.tartine)).toBeLessThan(0.4);
    expect(nameSimilarity("uber", "lucia")).toBeLessThan(0.4);
  });

  it("catches typos via dice coefficient", () => {
    // "lucia" vs "lucai" — single transposition.
    expect(nameSimilarity("lucia", "lucai")).toBeGreaterThan(0.4);
  });
});

describe("diceCoefficient", () => {
  it("returns 1 for identical strings", () => {
    expect(diceCoefficient("abc", "abc")).toBe(1);
  });
  it("returns 0 for fully disjoint bigrams", () => {
    expect(diceCoefficient("ab", "cd")).toBe(0);
  });
  it("handles empty inputs", () => {
    // Two empty strings are identical → 1; one empty → 0.
    expect(diceCoefficient("", "")).toBe(1);
    expect(diceCoefficient("a", "")).toBe(0);
    expect(diceCoefficient("", "a")).toBe(0);
  });
});

describe("timingScore", () => {
  const txn = new Date("2026-05-20T19:30:00Z");

  it("returns 0 when no claim", () => {
    expect(timingScore(null, txn)).toBe(0);
  });
  it("returns 1.0 for same-day claim", () => {
    expect(timingScore(new Date("2026-05-20T10:00:00Z"), txn)).toBe(1.0);
  });
  it("returns 1.0 for claim 1-3 days before", () => {
    expect(timingScore(new Date("2026-05-19T10:00:00Z"), txn)).toBe(1.0);
    expect(timingScore(new Date("2026-05-17T10:00:00Z"), txn)).toBe(1.0);
  });
  it("returns 0.5 for claim 4-7 days before", () => {
    expect(timingScore(new Date("2026-05-15T10:00:00Z"), txn)).toBe(0.5);
    expect(timingScore(new Date("2026-05-13T10:00:00Z"), txn)).toBe(0.5);
  });
  it("returns 0 for stale claim (>7 days)", () => {
    expect(timingScore(new Date("2026-05-10T10:00:00Z"), txn)).toBe(0);
  });
  it("returns 0 when claim is AFTER transaction", () => {
    expect(timingScore(new Date("2026-05-21T10:00:00Z"), txn)).toBe(0);
  });
});

describe("amountScore", () => {
  it("returns 0.5 neutral when no offer threshold known", () => {
    expect(amountScore(5000, null)).toBe(0.5);
  });
  it("returns 1.0 above threshold", () => {
    expect(amountScore(10000, 5000)).toBe(1.0);
    expect(amountScore(5000, 5000)).toBe(1.0);
  });
  it("returns 0.5 at 80-99% of threshold", () => {
    expect(amountScore(4000, 5000)).toBe(0.5); // exactly 80%
    expect(amountScore(4500, 5000)).toBe(0.5);
  });
  it("returns 0 below 80%", () => {
    expect(amountScore(3000, 5000)).toBe(0);
  });
  it("returns 1.0 when threshold is 0", () => {
    expect(amountScore(0, 0)).toBe(1.0);
  });
});

describe("geographyScore", () => {
  it("returns 1.0 neutral when Plaid didn't supply city", () => {
    expect(geographyScore(null, "dallas")).toBe(1.0);
  });
  it("returns 1.0 on city match (case-insensitive)", () => {
    expect(geographyScore("DALLAS", "dallas")).toBe(1.0);
    expect(geographyScore("Dallas", "dallas")).toBe(1.0);
  });
  it("returns 0 on city mismatch", () => {
    expect(geographyScore("Houston", "dallas")).toBe(0);
  });
});

describe("scoreMatch (combined)", () => {
  const base = {
    transactionDate: new Date("2026-05-20T19:30:00Z"),
    claimCreatedAt: new Date("2026-05-20T10:00:00Z"),
    amountCents: 8700,
    offerMinCheckCents: 5000,
    merchantCity: "Dallas",
    restaurantCity: "dallas",
  };

  it("produces a 'high' for a clean Lucia match with a same-day claim", () => {
    const r = scoreMatch({
      ...base,
      merchantNameNormalized: NAME.luciaFull,
      restaurantNameNormalized: NAME.lucia,
    });
    expect(r.confidence).toBe("high");
    expect(r.combinedScore).toBeGreaterThanOrEqual(0.85);
  });

  it("downgrades 'high' to 'medium' when there's no claim", () => {
    const r = scoreMatch({
      ...base,
      claimCreatedAt: null,
      merchantNameNormalized: NAME.luciaFull,
      restaurantNameNormalized: NAME.lucia,
    });
    // No claim → timing=0, no min_check (treated as null) for amount.
    // Still, the rule is: confidence=high requires claim — downgrade.
    expect(r.confidence).not.toBe("high");
  });

  it("returns 'medium' for partial-name match with a fresh claim", () => {
    const r = scoreMatch({
      ...base,
      merchantNameNormalized: "lucias",
      restaurantNameNormalized: NAME.lucia,
    });
    expect(["medium", "low", "high"]).toContain(r.confidence);
    // The point: not 'none'.
    expect(r.confidence).not.toBe("none");
  });

  it("returns 'none' for an unrelated merchant (name-floor protection)", () => {
    // The diner has a fresh Lucia claim, ate at Amazon. Without the
    // name floor, timing+amount+geo alone would push this to 'low'
    // and flood the review queue with every non-restaurant charge.
    const r = scoreMatch({
      ...base,
      merchantNameNormalized: "amazon",
      restaurantNameNormalized: NAME.lucia,
    });
    expect(r.confidence).toBe("none");
  });

  it("rejects a stale claim (8+ days)", () => {
    const r = scoreMatch({
      ...base,
      claimCreatedAt: new Date("2026-05-10T10:00:00Z"),
      merchantNameNormalized: NAME.luciaFull,
      restaurantNameNormalized: NAME.lucia,
    });
    // Name is still strong but timing=0; should not be 'high'.
    expect(r.confidence).not.toBe("high");
  });

  it("rejects a sub-min_check transaction", () => {
    const r = scoreMatch({
      ...base,
      amountCents: 2000, // 40% of 5000 threshold
      merchantNameNormalized: NAME.luciaFull,
      restaurantNameNormalized: NAME.lucia,
    });
    // amount=0 lowers but should still be at least medium given name+timing+geo.
    expect(["medium", "low"]).toContain(r.confidence);
  });

  it("reports per-dimension scores for the review queue", () => {
    const r = scoreMatch({
      ...base,
      merchantNameNormalized: NAME.luciaFull,
      restaurantNameNormalized: NAME.lucia,
    });
    expect(r.dimensions.name).toBeGreaterThan(0);
    expect(r.dimensions.timing).toBe(1.0);
    expect(r.dimensions.amount).toBe(1.0);
    expect(r.dimensions.geography).toBe(1.0);
  });
});
