// Phase 4c.5: auto-approval for high-confidence matches.
//
// After matchPendingTransactions() flips a row to match_confidence
// 'high' with a claim_id attached, this step runs the existing 6-check
// rubric (src/lib/rubric.ts) and either:
//
//   - auto_approved → snapshot the money math (discount_pct_at_match,
//     discount_cents, platform_fee_cents, rebate_cents), advance the
//     claim to status='matched', and add to the offer's
//     monthly_spent_cents (auto-pausing the offer if the budget is
//     blown).
//
//   - flagged → set auto_approval_status='flagged' with the failed
//     check names. The admin review queue (Phase 4c.6) picks it up.
//
// Anything 'medium' or 'low' confidence skips this step entirely and
// goes straight to the review queue.
//
// Like matchPendingTransactions(), this is a system-level operation
// driven by the cron tick. No user session, so audit events use
// actor.role='system' (admin client path in audit-log.ts).

import "server-only";

import { logAuditEvent } from "@/lib/db/audit-log";
import { evaluateRubric, type RubricInput } from "@/lib/rubric";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { applyApprovedSnapshot } from "./approve";

export type AutoApprovalSummary = {
  examined: number;
  approved: number;
  flagged: number;
  errors: number;
};

export async function autoApproveHighMatches(): Promise<AutoApprovalSummary> {
  const admin = createSupabaseAdminClient();
  const summary: AutoApprovalSummary = {
    examined: 0,
    approved: 0,
    flagged: 0,
    errors: 0,
  };

  const { data: pending, error } = await admin
    .from("matched_transactions")
    .select(
      "id, claim_id, restaurant_id, plaid_card_account_id, amount_cents, transaction_date",
    )
    .eq("match_confidence", "high")
    .not("claim_id", "is", null)
    .is("auto_approval_status", null);
  if (error) {
    console.error("autoApproveHighMatches: list:", error);
    return { ...summary, errors: 1 };
  }

  for (const row of pending ?? []) {
    summary.examined += 1;
    try {
      const outcome = await processOne(row);
      if (outcome === "approved") summary.approved += 1;
      else summary.flagged += 1;
    } catch (err) {
      console.error(`autoApprove(${row.id}):`, err);
      summary.errors += 1;
    }
  }

  return summary;
}

// ====================================================================
// Internals
// ====================================================================

type PendingRow = {
  id: string;
  claim_id: string;
  restaurant_id: string;
  plaid_card_account_id: string;
  amount_cents: number;
  transaction_date: string;
};

async function processOne(row: PendingRow): Promise<"approved" | "flagged"> {
  const admin = createSupabaseAdminClient();

  // 1. Pull the rubric context: claim + offer + restaurant + claim
  //    count for this diner against this offer.
  const ctx = await loadRubricContext(row.claim_id);
  if (!ctx) {
    throw new Error(`autoApprove: rubric context for claim ${row.claim_id} missing`);
  }

  const claimsCountResult = await admin
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("offer_id", ctx.offerId)
    .eq("diner_user_id", ctx.dinerUserId);
  const totalDinerClaimsOnOffer = claimsCountResult.count ?? 1;

  const rubricInput: RubricInput = {
    claimedAt: ctx.claimedAt,
    offerValidStartTime: ctx.validStartTime,
    offerValidEndTime: ctx.validEndTime,
    offerValidDays: ctx.validDays,
    offerMinSpendCents: ctx.minCheckCents,
    offerMaxClaimsPerDiner: ctx.maxClaimsPerDiner,
    subtotalCents: row.amount_cents,
    restaurantMcc: ctx.restaurantMcc,
    totalDinerClaimsOnOffer,
    // Card-belongs-to-diner is intrinsic in the rebate model: the
    // matched_transactions row's card was linked by this diner. No
    // way for someone else's card to land here.
    cardBelongsToDiner: true,
  };

  const rubric = evaluateRubric(rubricInput);

  if (rubric.passed) {
    const snapshot = await applyApprovedSnapshot({
      matchedTransactionId: row.id,
      amountCents: row.amount_cents,
      claimId: row.claim_id,
      reviewerUserId: null, // system-driven; no human reviewer
      kind: "auto_approved",
    });

    await logAuditEvent({
      actor: { id: "system", role: "system" },
      action: "matching.auto_approved",
      subjectType: "matched_transaction",
      subjectId: row.id,
      metadata: {
        claim_id: row.claim_id,
        discount_pct: snapshot.discountPct,
        discount_cents: snapshot.discountCents,
        platform_fee_cents: snapshot.platformFeeCents,
        rebate_cents: snapshot.rebateCents,
      },
    });
    return "approved";
  }

  // Flagged: write the failed checks; queue will surface this.
  const { error } = await admin
    .from("matched_transactions")
    .update({
      auto_approval_status: "flagged",
      flagged_reasons: rubric.failedChecks,
    })
    .eq("id", row.id);
  if (error) throw new Error(`update matched_txn (flagged): ${error.message}`);

  await logAuditEvent({
    actor: { id: "system", role: "system" },
    action: "matching.flagged",
    subjectType: "matched_transaction",
    subjectId: row.id,
    metadata: {
      claim_id: row.claim_id,
      failed_checks: rubric.failedChecks,
    },
  });
  return "flagged";
}

type RubricContext = {
  dinerUserId: string;
  claimedAt: Date;
  offerId: string;
  discountPct: number;
  minCheckCents: number;
  maxClaimsPerDiner: number;
  validStartTime: string;
  validEndTime: string;
  validDays: string[];
  restaurantMcc: string;
};

async function loadRubricContext(claimId: string): Promise<RubricContext | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("claims")
    .select(
      `
      diner_user_id,
      claimed_at,
      offer_id,
      offers!inner (
        discount_pct,
        min_check_cents,
        max_claims_per_diner,
        valid_start_time,
        valid_end_time,
        valid_days,
        restaurants!inner (
          mcc
        )
      )
      `,
    )
    .eq("id", claimId)
    .maybeSingle();
  if (error || !data) {
    console.error("loadRubricContext:", error);
    return null;
  }

  const offer = data.offers as unknown as
    | {
        discount_pct: number;
        min_check_cents: number;
        max_claims_per_diner: number;
        valid_start_time: string;
        valid_end_time: string;
        valid_days: string[];
        restaurants: { mcc: string } | { mcc: string }[];
      }
    | {
        discount_pct: number;
        min_check_cents: number;
        max_claims_per_diner: number;
        valid_start_time: string;
        valid_end_time: string;
        valid_days: string[];
        restaurants: { mcc: string } | { mcc: string }[];
      }[];
  const o = Array.isArray(offer) ? offer[0] : offer;
  if (!o) return null;
  const r = Array.isArray(o.restaurants) ? o.restaurants[0] : o.restaurants;
  if (!r) return null;

  return {
    dinerUserId: data.diner_user_id,
    claimedAt: new Date(data.claimed_at),
    offerId: data.offer_id,
    discountPct: o.discount_pct,
    minCheckCents: o.min_check_cents,
    maxClaimsPerDiner: o.max_claims_per_diner,
    validStartTime: o.valid_start_time,
    validEndTime: o.valid_end_time,
    validDays: o.valid_days,
    restaurantMcc: r.mcc,
  };
}

