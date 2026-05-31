import { describe, expect, it } from "vitest";

import { descriptorMatches, normalizeMerchantName } from "./normalize";

describe("normalizeMerchantName", () => {
  it("returns empty for empty input", () => {
    expect(normalizeMerchantName("")).toBe("");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeMerchantName("LUCIA         DALLAS TX")).toBe("lucia dallas");
    expect(normalizeMerchantName("  Lucia  ")).toBe("lucia");
  });

  it("strips Toast POS prefix", () => {
    expect(normalizeMerchantName("TST* Lucia")).toBe("lucia");
    expect(normalizeMerchantName("TST*Lucia")).toBe("lucia");
  });

  it("strips Square POS prefix in both formats", () => {
    expect(normalizeMerchantName("SQ *LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("SQ*LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("SQ * LUCIA")).toBe("lucia");
  });

  it("strips other common payment-processor prefixes", () => {
    expect(normalizeMerchantName("STRIPE *LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("PAYPAL *LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("PP*LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("CLOVER *LUCIA")).toBe("lucia");
  });

  it("strips delivery-aggregator prefixes", () => {
    expect(normalizeMerchantName("DOORDASH *LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("UBER EATS *LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("UBER EATS LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("GRUBHUB LUCIA")).toBe("lucia");
  });

  it("strips reservation-platform prefixes", () => {
    expect(normalizeMerchantName("OPENTABLE *LUCIA")).toBe("lucia");
    expect(normalizeMerchantName("RESY LUCIA")).toBe("lucia");
  });

  it("strips trailing state abbreviation", () => {
    expect(normalizeMerchantName("LUCIA RESTAURANT TX")).toBe("lucia restaurant");
    expect(normalizeMerchantName("LUCIA DALLAS TX")).toBe("lucia dallas");
  });

  it("strips trailing zip code", () => {
    expect(normalizeMerchantName("LUCIA 75208")).toBe("lucia");
    expect(normalizeMerchantName("LUCIA TX 75208")).toBe("lucia");
  });

  it("strips store numbers in #N format", () => {
    expect(normalizeMerchantName("Lucia #1234")).toBe("lucia");
  });

  it("strips trailing pure-number tokens (store numbers)", () => {
    expect(normalizeMerchantName("LUCIA 4567")).toBe("lucia");
  });

  it("preserves restaurant-type words (would be info loss to strip)", () => {
    expect(normalizeMerchantName("Bishop Arts Restaurant"))
      .toBe("bishop arts restaurant");
    expect(normalizeMerchantName("The Wine Bar"))
      .toBe("the wine bar");
  });

  it("keeps truncated trailing words as-is (BISHOP A from BISHOP ARTS)", () => {
    // 'a' is a single-letter token, not a state — keep it.
    expect(normalizeMerchantName("LUCIA RESTAURANT BISHOP A"))
      .toBe("lucia restaurant bishop a");
  });

  it("handles a real-world Plaid sandbox string", () => {
    // Plaid sandbox often returns 'United Airlines' or food items.
    expect(normalizeMerchantName("Tartine Bakery & Cafe"))
      .toBe("tartine bakery cafe");
  });

  it("strips multiple stacked prefixes", () => {
    expect(normalizeMerchantName("TST*SQ *LUCIA")).toBe("lucia");
  });

  it("handles punctuation and accents reasonably", () => {
    expect(normalizeMerchantName("Café Lucia, Dallas, TX 75208"))
      .toBe("caf lucia dallas");
    // (the é → space via [^a-z0-9] rule; acceptable for v1)
  });

  it("is idempotent (normalize(normalize(x)) === normalize(x))", () => {
    const samples = [
      "TST* Lucia",
      "LUCIA RESTAURANT BISHOP ARTS",
      "SQ *LUCIA TX 75208",
      "DOORDASH *Tartine Bakery & Cafe",
    ];
    for (const s of samples) {
      const once = normalizeMerchantName(s);
      const twice = normalizeMerchantName(once);
      expect(twice).toBe(once);
    }
  });
});

describe("descriptorMatches", () => {
  // Helper: compare the way the matcher does — normalize both sides.
  const matches = (merchant: string, descriptor: string) =>
    descriptorMatches(
      normalizeMerchantName(merchant),
      normalizeMerchantName(descriptor),
    );

  it("matches the exact statement string", () => {
    expect(matches("La Playa Cafe Bar Bsp Ar", "La Playa Cafe Bar Bsp Ar")).toBe(
      true,
    );
  });

  it("matches across processor prefixes (normalizer strips them)", () => {
    expect(matches("TST* La Playa Cafe Bar", "La Playa Cafe Bar")).toBe(true);
    expect(matches("SQ *LA PLAYA CAFE BAR", "La Playa Cafe Bar")).toBe(true);
  });

  it("survives bank truncation (one side is a prefix of the other)", () => {
    // A harsher-truncating bank shows fewer chars; still the same merchant.
    expect(matches("La Playa Cafe B", "La Playa Cafe Bar Bsp")).toBe(true);
    expect(matches("La Playa Cafe Bar Bsp", "La Playa Cafe B")).toBe(true);
  });

  it("matches when location tokens are present on one side only", () => {
    expect(matches("La Playa Cafe Bar Dallas", "La Playa Cafe Bar")).toBe(true);
  });

  it("does NOT match a different restaurant", () => {
    expect(matches("Lucia Bishop Arts", "La Playa Cafe Bar")).toBe(false);
    expect(matches("Wendigo Cellar", "La Playa Cafe Bar Bsp Ar")).toBe(false);
  });

  it("does NOT match on a tiny shared prefix", () => {
    // "la" is too short to be a meaningful prefix.
    expect(matches("La Bamba Taqueria", "La Playa Cafe Bar")).toBe(false);
  });

  it("is false when either side is empty", () => {
    expect(descriptorMatches("", "la playa")).toBe(false);
    expect(descriptorMatches("la playa", "")).toBe(false);
  });
});
