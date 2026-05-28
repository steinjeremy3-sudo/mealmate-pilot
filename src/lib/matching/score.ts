// Match-confidence scoring for Phase 4c.
//
// Goal: given a normalized Plaid transaction and a candidate restaurant
// (plus a possibly-open claim), produce a confidence enum that decides
// whether we auto-approve, manual-review, or ignore.
//
// Four dimensions, weighted:
//
//   name       55%   — how similar is the merchant name to the
//                      restaurant name (token containment + Dice
//                      coefficient on bigrams). Single biggest signal.
//   timing     20%   — was a claim placed 0–3 days before the
//                      transaction date? Without a claim we can't
//                      rebate, so this is binary-ish.
//   amount     15%   — does the transaction amount clear the offer's
//                      min_check_cents threshold? Partial credit at
//                      80–99% of threshold for grace.
//   geography  10%   — restaurant + transaction city match (sanity).
//                      In the pilot every restaurant is Dallas, so
//                      this defaults to 1.0 unless we have evidence
//                      to the contrary from Plaid.
//
// Cutoffs (combined score):
//   ≥ 0.85   high     → auto-approve via rubric (Phase 4c.5)
//   ≥ 0.65   medium   → manual review queue
//   ≥ 0.40   low      → manual review queue, lower priority
//   < 0.40   none     → log, do nothing
//
// Also: `high` requires a claim_id. Without one, we can't compute the
// rebate, so we drop to medium for the review queue to attach it.

export type MatchConfidence = "high" | "medium" | "low" | "none";

export type ScoreInputs = {
  /** Pre-normalized merchant name (use normalizeMerchantName). */
  merchantNameNormalized: string;
  /** Pre-normalized restaurant name. */
  restaurantNameNormalized: string;

  /** Transaction date (date-only, no tz). */
  transactionDate: Date;
  /** Diner's most recent open claim at this restaurant, if any. */
  claimCreatedAt: Date | null;

  /** Transaction amount, cents. */
  amountCents: number;
  /** Offer's min_check_cents (from the claim's offer), or null if no claim. */
  offerMinCheckCents: number | null;

  /**
   * Optional: Plaid's reported city for the merchant location, or null
   * if Plaid didn't include it. We compare against the restaurant city.
   */
  merchantCity: string | null;
  /** Restaurant city, lowercased ("dallas"). */
  restaurantCity: string;
};

export type ScoreResult = {
  confidence: MatchConfidence;
  combinedScore: number; // 0..1, useful for the review queue sort.
  dimensions: {
    name: number;
    timing: number;
    amount: number;
    geography: number;
  };
};

const WEIGHTS = { name: 0.55, timing: 0.2, amount: 0.15, geography: 0.1 };
const CUTOFFS = { high: 0.85, medium: 0.65, low: 0.4 };

/**
 * Name-similarity floor. If the merchant doesn't look at least
 * weakly like the restaurant we drop straight to 'none' — otherwise
 * a fresh claim + Dallas geo + amount-pass would give every Amazon
 * charge a 'low' against every restaurant, flooding the queue.
 *
 * 0.55 covers any reasonable Dice-coefficient overlap from a real
 * abbreviation / branding variant ("Lucia Restaurant" vs "Lucia"
 * lands well above; "Wendigo Cellar" vs "Wendigo" lands above).
 * 0.35 was the original floor and let too much garbage into the
 * 'low' tier — at any meaningful volume that floods the queue.
 */
const NAME_FLOOR_FOR_ANY_MATCH = 0.55;

export function scoreMatch(input: ScoreInputs): ScoreResult {
  const name = nameSimilarity(
    input.merchantNameNormalized,
    input.restaurantNameNormalized,
  );

  const timing = timingScore(input.claimCreatedAt, input.transactionDate);
  const amount = amountScore(input.amountCents, input.offerMinCheckCents);
  const geography = geographyScore(input.merchantCity, input.restaurantCity);

  const combined =
    WEIGHTS.name * name +
    WEIGHTS.timing * timing +
    WEIGHTS.amount * amount +
    WEIGHTS.geography * geography;

  let confidence: MatchConfidence;
  if (name < NAME_FLOOR_FOR_ANY_MATCH) confidence = "none";
  else if (combined >= CUTOFFS.high) confidence = "high";
  else if (combined >= CUTOFFS.medium) confidence = "medium";
  else if (combined >= CUTOFFS.low) confidence = "low";
  else confidence = "none";

  // High requires a claim — otherwise we have nothing to rebate
  // against. Drop to medium so it lands in the review queue, where
  // ops can attach a claim manually or reject.
  if (confidence === "high" && !input.claimCreatedAt) {
    confidence = "medium";
  }

  return {
    confidence,
    combinedScore: round3(combined),
    dimensions: {
      name: round3(name),
      timing: round3(timing),
      amount: round3(amount),
      geography: round3(geography),
    },
  };
}

// ====================================================================
// Dimension helpers
// ====================================================================

/**
 * Name similarity: token-containment OR Dice coefficient on bigrams.
 * Pick the higher of the two. Both inputs are pre-normalized.
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1.0;

  const containment = tokenContainment(a, b);
  const dice = diceCoefficient(a, b);
  return Math.max(containment, dice);
}

/**
 * If one side's tokens are fully contained in the other side's, that's
 * a strong signal (e.g. "lucia" vs "lucia restaurant bishop arts").
 * Returns 0.9 on full containment of the shorter side, 0 otherwise.
 */
function tokenContainment(a: string, b: string): number {
  const at = new Set(a.split(/\s+/).filter(Boolean));
  const bt = new Set(b.split(/\s+/).filter(Boolean));
  if (at.size === 0 || bt.size === 0) return 0;

  const [smaller, larger] = at.size <= bt.size ? [at, bt] : [bt, at];
  // Skip noise-only tokens of length 1 when computing containment.
  const meaningful = [...smaller].filter((t) => t.length > 1);
  if (meaningful.length === 0) return 0;
  const allIn = meaningful.every((t) => larger.has(t));
  return allIn ? 0.9 : 0;
}

/**
 * Dice coefficient on character bigrams. Standard fuzzy-string metric;
 * good at catching typos and minor variations without being length-
 * sensitive the way Jaro-Winkler is.
 */
export function diceCoefficient(a: string, b: string): number {
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  if (aBigrams.length === 0 && bBigrams.length === 0) return a === b ? 1 : 0;
  if (aBigrams.length === 0 || bBigrams.length === 0) return 0;

  // Count multiset intersection size.
  const bMap = new Map<string, number>();
  for (const g of bBigrams) bMap.set(g, (bMap.get(g) ?? 0) + 1);
  let inter = 0;
  for (const g of aBigrams) {
    const c = bMap.get(g) ?? 0;
    if (c > 0) {
      inter += 1;
      bMap.set(g, c - 1);
    }
  }
  return (2 * inter) / (aBigrams.length + bBigrams.length);
}

function bigrams(s: string): string[] {
  if (s.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/**
 * Timing score: 1.0 if the claim was placed 0–3 days before the
 * transaction. 0.5 if 4–7 days (people sometimes claim ahead). 0
 * otherwise (claim too old / claim after the transaction).
 */
export function timingScore(
  claimCreatedAt: Date | null,
  transactionDate: Date,
): number {
  if (!claimCreatedAt) return 0;
  const claim = startOfDayUtc(claimCreatedAt);
  const txn = startOfDayUtc(transactionDate);
  const diffDays = Math.round(
    (txn.getTime() - claim.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays < 0) return 0;
  if (diffDays <= 3) return 1.0;
  if (diffDays <= 7) return 0.5;
  return 0;
}

/**
 * Amount score: 1.0 if the transaction meets the offer min_check;
 * 0.5 at 80–99% (grace for tax/tip variance); 0 below 80%.
 *
 * If no claim/offer is available (offerMinCheckCents == null), treat
 * as neutral (0.5) — we can't penalize for an unknown threshold.
 */
export function amountScore(
  amountCents: number,
  offerMinCheckCents: number | null,
): number {
  if (offerMinCheckCents == null) return 0.5;
  if (offerMinCheckCents <= 0) return 1.0;
  const ratio = amountCents / offerMinCheckCents;
  if (ratio >= 1.0) return 1.0;
  if (ratio >= 0.8) return 0.5;
  return 0;
}

/**
 * Geography score: 1.0 if Plaid didn't surface a city (so we can't
 * disprove a match) OR the cities match. 0 if cities clearly differ.
 *
 * Restaurant pilot is Dallas-only so the typical signal is "Plaid
 * said Dallas → match". Cross-city transactions are uncommon and
 * should fail this dimension.
 */
export function geographyScore(
  merchantCity: string | null,
  restaurantCity: string,
): number {
  if (!merchantCity) return 1.0;
  return merchantCity.trim().toLowerCase() === restaurantCity.trim().toLowerCase()
    ? 1.0
    : 0;
}

// ====================================================================
// Small utilities
// ====================================================================

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
