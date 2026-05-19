// Phase 4c: matching orchestrator.
//
// For every `matched_transactions` row that's still in the initial
// state (match_confidence='none' AND restaurant_id IS NULL):
//
//   1. Resolve the diner from the card → item chain.
//   2. Try every active restaurant as a candidate; keep the one with
//      the highest name-similarity score.
//   3. Look for the diner's most recent open claim at that restaurant
//      within a 7-day window before the transaction date.
//   4. Run the full scorer → confidence enum.
//   5. Write back restaurant_id, claim_id, merchant_name_normalized,
//      and match_confidence in one update.
//
// We re-attempt rows that scored 'none' on every cron run — cheap at
// pilot scale (handful of restaurants × handful of unmatched txns).
// If this gets expensive we add a `last_match_attempt_at` column and
// skip rows attempted within the last hour.

import "server-only";

import { logAuditEvent } from "@/lib/db/audit-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { normalizeMerchantName } from "./normalize";
import {
  nameSimilarity,
  scoreMatch,
  type MatchConfidence,
  type ScoreResult,
} from "./score";

export type MatchSummary = {
  examined: number;
  matchedHigh: number;
  matchedMedium: number;
  matchedLow: number;
  unmatched: number;
  errors: number;
};

const CLAIM_WINDOW_DAYS = 7;

export async function matchPendingTransactions(): Promise<MatchSummary> {
  const admin = createSupabaseAdminClient();

  const restaurants = await loadActiveRestaurants();
  if (restaurants.length === 0) {
    return zeroSummary();
  }

  const { data: pending, error } = await admin
    .from("matched_transactions")
    .select(
      "id, plaid_card_account_id, merchant_name_raw, merchant_name_normalized, amount_cents, transaction_date",
    )
    .eq("match_confidence", "none")
    .is("restaurant_id", null);
  if (error) {
    console.error("matchPendingTransactions: list pending:", error);
    return { ...zeroSummary(), errors: 1 };
  }

  const summary: MatchSummary = zeroSummary();

  for (const row of pending ?? []) {
    summary.examined += 1;
    try {
      const updated = await matchOne(row, restaurants);
      if (updated.confidence === "high") summary.matchedHigh += 1;
      else if (updated.confidence === "medium") summary.matchedMedium += 1;
      else if (updated.confidence === "low") summary.matchedLow += 1;
      else summary.unmatched += 1;
    } catch (err) {
      console.error(`matchOne(${row.id}):`, err);
      summary.errors += 1;
    }
  }

  // (No batch-summary audit event — subject_id is NOT NULL on audit_log
  // and a sentinel UUID would be misleading. The cron route logs the
  // aggregate counts to console / Vercel logs instead, and per-row
  // `matching.matched` events provide the audit detail.)

  return summary;
}

// ====================================================================
// Internals
// ====================================================================

type ActiveRestaurant = {
  id: string;
  name: string;
  nameNormalized: string;
  city: string;
  mcc: string;
};

type PendingRow = {
  id: string;
  plaid_card_account_id: string;
  merchant_name_raw: string;
  merchant_name_normalized: string | null;
  amount_cents: number;
  transaction_date: string;
};

type MatchOutcome = {
  confidence: MatchConfidence;
  restaurantId: string | null;
  claimId: string | null;
};

async function matchOne(
  row: PendingRow,
  restaurants: ActiveRestaurant[],
): Promise<MatchOutcome> {
  const admin = createSupabaseAdminClient();

  // Ensure normalized name (older ingestions may have it nullable).
  const merchantNorm =
    row.merchant_name_normalized ?? normalizeMerchantName(row.merchant_name_raw);

  // 1. Pick the highest-similarity restaurant candidate (cheap, brute).
  let best: { restaurant: ActiveRestaurant; nameScore: number } | null = null;
  for (const r of restaurants) {
    const score = nameSimilarity(merchantNorm, r.nameNormalized);
    if (!best || score > best.nameScore) {
      best = { restaurant: r, nameScore: score };
    }
  }

  if (!best || best.nameScore < 0.35) {
    // No candidate clears the floor — record the normalized name so
    // a future ops session can spot near-misses, but leave it 'none'.
    await admin
      .from("matched_transactions")
      .update({ merchant_name_normalized: merchantNorm })
      .eq("id", row.id);
    return { confidence: "none", restaurantId: null, claimId: null };
  }

  // 2. Find the most recent open claim by this diner at this restaurant
  //    within the 7-day window before the transaction date.
  const dinerUserId = await dinerForCard(row.plaid_card_account_id);
  const txnDate = new Date(`${row.transaction_date}T00:00:00Z`);
  const claim = dinerUserId
    ? await findOpenClaim(dinerUserId, best.restaurant.id, txnDate)
    : null;

  // 3. Score the candidate fully.
  const result: ScoreResult = scoreMatch({
    merchantNameNormalized: merchantNorm,
    restaurantNameNormalized: best.restaurant.nameNormalized,
    transactionDate: txnDate,
    claimCreatedAt: claim?.claimedAt ?? null,
    amountCents: row.amount_cents,
    offerMinCheckCents: claim?.offerMinCheckCents ?? null,
    merchantCity: null, // Plaid location.city not yet stored; future column.
    restaurantCity: best.restaurant.city.toLowerCase(),
  });

  // 4. Write back. 'none' still gets normalized name written so the
  //    review queue can surface near-misses by string search.
  const update: Record<string, unknown> = {
    merchant_name_normalized: merchantNorm,
    match_confidence: result.confidence,
  };
  if (result.confidence !== "none") {
    update.restaurant_id = best.restaurant.id;
    if (claim) update.claim_id = claim.id;
  }

  const { error } = await admin
    .from("matched_transactions")
    .update(update)
    .eq("id", row.id);
  if (error) {
    throw new Error(`update matched_transactions: ${error.message}`);
  }

  if (result.confidence !== "none") {
    await logAuditEvent({
      actor: { id: "system", role: "system" },
      action: "matching.matched",
      subjectType: "matched_transaction",
      subjectId: row.id,
      metadata: {
        confidence: result.confidence,
        combined_score: result.combinedScore,
        dimensions: result.dimensions,
        restaurant_id: best.restaurant.id,
        claim_id: claim?.id ?? null,
      },
    });
  }

  return {
    confidence: result.confidence,
    restaurantId: result.confidence !== "none" ? best.restaurant.id : null,
    claimId: claim?.id ?? null,
  };
}

async function loadActiveRestaurants(): Promise<ActiveRestaurant[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("restaurants")
    .select("id, name, city, mcc")
    .eq("status", "approved");
  if (error) {
    console.error("loadActiveRestaurants:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    nameNormalized: normalizeMerchantName(r.name),
    city: r.city,
    mcc: r.mcc,
  }));
}

async function dinerForCard(plaidCardAccountId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("plaid_card_accounts")
    .select("plaid_item_id, plaid_items!inner(user_id)")
    .eq("id", plaidCardAccountId)
    .maybeSingle();
  if (error || !data) return null;
  // Supabase types the join as a nested object.
  const items = data.plaid_items as unknown as { user_id: string } | { user_id: string }[];
  if (Array.isArray(items)) return items[0]?.user_id ?? null;
  return items?.user_id ?? null;
}

type OpenClaim = {
  id: string;
  claimedAt: Date;
  offerMinCheckCents: number;
};

async function findOpenClaim(
  dinerUserId: string,
  restaurantId: string,
  txnDate: Date,
): Promise<OpenClaim | null> {
  const admin = createSupabaseAdminClient();
  const windowStart = new Date(txnDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - CLAIM_WINDOW_DAYS);

  const { data, error } = await admin
    .from("claims")
    .select(
      "id, claimed_at, status, offers!inner(restaurant_id, min_check_cents)",
    )
    .eq("diner_user_id", dinerUserId)
    .in("status", ["claimed", "matched"])
    .gte("claimed_at", windowStart.toISOString())
    .order("claimed_at", { ascending: false });
  if (error || !data) return null;

  for (const row of data) {
    const offer = row.offers as unknown as {
      restaurant_id: string;
      min_check_cents: number;
    } | { restaurant_id: string; min_check_cents: number }[];
    const o = Array.isArray(offer) ? offer[0] : offer;
    if (o?.restaurant_id === restaurantId) {
      return {
        id: row.id,
        claimedAt: new Date(row.claimed_at),
        offerMinCheckCents: o.min_check_cents,
      };
    }
  }
  return null;
}

function zeroSummary(): MatchSummary {
  return {
    examined: 0,
    matchedHigh: 0,
    matchedMedium: 0,
    matchedLow: 0,
    unmatched: 0,
    errors: 0,
  };
}
