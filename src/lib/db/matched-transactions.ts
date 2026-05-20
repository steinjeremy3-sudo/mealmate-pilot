// Admin reads for matched_transactions (Phase 4c review queue).
//
// Uses the admin client because matched_transactions doesn't yet have
// RLS policies that admit admin SELECT — Phase 4c.7 adds them, after
// which we'll switch to the user-scoped server client. Routing through
// the admin layout means every caller already passed requireRole('admin').

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MatchConfidence = "high" | "medium" | "low" | "none";
export type AutoApprovalStatus =
  | "auto_approved"
  | "flagged"
  | "rejected"
  | "manual_approved";

/** A row formatted for the admin review queue list view. */
export type ReviewRow = {
  id: string;
  matchConfidence: MatchConfidence;
  autoApprovalStatus: AutoApprovalStatus | null;
  amountCents: number;
  transactionDate: string;
  merchantNameRaw: string;
  flaggedReasons: string[] | null;
  restaurant: { id: string; name: string } | null;
  claim: {
    id: string;
    offer: { id: string; title: string; discountPct: number } | null;
    diner: { id: string; displayName: string; email: string | null } | null;
  } | null;
  createdAt: string;
};

/** Detailed view for the per-row admin page. Strict superset of ReviewRow. */
export type ReviewDetail = ReviewRow & {
  merchantNameNormalized: string | null;
  offerMinCheckCents: number | null;
  restaurantCity: string | null;
};

/**
 * Everything the queue surfaces: medium / low confidence rows AND
 * flagged auto-approval rows (the rubric rejected an otherwise-high
 * match). Newest first.
 */
export async function getPendingReviewMatches(): Promise<ReviewRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("matched_transactions")
    .select(
      `
      id, match_confidence, auto_approval_status, amount_cents,
      transaction_date, merchant_name_raw, flagged_reasons, created_at,
      restaurants ( id, name ),
      claims (
        id,
        offers ( id, title, discount_pct ),
        diner:users!claims_diner_user_id_users_id_fk ( id, display_name, email )
      )
      `,
    )
    .or(
      "match_confidence.in.(medium,low),auto_approval_status.eq.flagged",
    )
    .is("reviewed_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getPendingReviewMatches:", error);
    return [];
  }
  return (data ?? []).map(rowToReview);
}

export async function getReviewMatchDetail(
  id: string,
): Promise<ReviewDetail | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("matched_transactions")
    .select(
      `
      id, match_confidence, auto_approval_status, amount_cents,
      transaction_date, merchant_name_raw, merchant_name_normalized,
      flagged_reasons, created_at,
      restaurants ( id, name, city ),
      claims (
        id,
        offers ( id, title, discount_pct, min_check_cents ),
        diner:users!claims_diner_user_id_users_id_fk ( id, display_name, email )
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getReviewMatchDetail:", error);
    return null;
  }
  if (!data) return null;
  return rowToDetail(data);
}

export type MatchScoreBreakdown = {
  combinedScore: number;
  dimensions: {
    name: number;
    timing: number;
    amount: number;
    geography: number;
  };
};

/**
 * The matcher's confidence breakdown for a transaction, recovered from
 * the `matching.matched` audit event the matcher writes. Returns null
 * if the transaction was never matched (pure 'none').
 */
export async function getMatchScoreBreakdown(
  matchedTransactionId: string,
): Promise<MatchScoreBreakdown | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("audit_log")
    .select("metadata")
    .eq("action", "matching.matched")
    .eq("subject_id", matchedTransactionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const meta = data.metadata as
    | { combined_score?: number; dimensions?: MatchScoreBreakdown["dimensions"] }
    | null;
  if (!meta?.dimensions || typeof meta.combined_score !== "number") return null;
  return { combinedScore: meta.combined_score, dimensions: meta.dimensions };
}

// ====================================================================
// Internals — coercion of Supabase's loose join types to ours.
// ====================================================================

type SupabaseJoinedRow = {
  id: string;
  match_confidence: MatchConfidence;
  auto_approval_status: AutoApprovalStatus | null;
  amount_cents: number;
  transaction_date: string;
  merchant_name_raw: string;
  merchant_name_normalized?: string | null;
  flagged_reasons: string[] | null;
  created_at: string;
  restaurants:
    | { id: string; name: string; city?: string }
    | { id: string; name: string; city?: string }[]
    | null;
  claims:
    | SupabaseClaim
    | SupabaseClaim[]
    | null;
};

type SupabaseClaim = {
  id: string;
  offers:
    | { id: string; title: string; discount_pct: number; min_check_cents?: number }
    | { id: string; title: string; discount_pct: number; min_check_cents?: number }[]
    | null;
  diner:
    | { id: string; display_name: string; email: string | null }
    | { id: string; display_name: string; email: string | null }[]
    | null;
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function rowToReview(row: SupabaseJoinedRow): ReviewRow {
  const restaurant = flatten(row.restaurants);
  const claim = flatten(row.claims);
  const offer = claim ? flatten(claim.offers) : null;
  const diner = claim ? flatten(claim.diner) : null;

  return {
    id: row.id,
    matchConfidence: row.match_confidence,
    autoApprovalStatus: row.auto_approval_status,
    amountCents: row.amount_cents,
    transactionDate: row.transaction_date,
    merchantNameRaw: row.merchant_name_raw,
    flaggedReasons: row.flagged_reasons,
    restaurant: restaurant ? { id: restaurant.id, name: restaurant.name } : null,
    claim: claim
      ? {
          id: claim.id,
          offer: offer
            ? { id: offer.id, title: offer.title, discountPct: offer.discount_pct }
            : null,
          diner: diner
            ? {
                id: diner.id,
                displayName: diner.display_name,
                email: diner.email,
              }
            : null,
        }
      : null,
    createdAt: row.created_at,
  };
}

function rowToDetail(row: SupabaseJoinedRow): ReviewDetail {
  const base = rowToReview(row);
  const restaurant = flatten(row.restaurants);
  const claim = flatten(row.claims);
  const offer = claim ? flatten(claim.offers) : null;
  return {
    ...base,
    merchantNameNormalized: row.merchant_name_normalized ?? null,
    offerMinCheckCents: offer?.min_check_cents ?? null,
    restaurantCity: restaurant?.city ?? null,
  };
}
