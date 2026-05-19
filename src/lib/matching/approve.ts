// Phase 4c shared approval helper.
//
// Both the cron auto-approval flow (4c.5) and the admin manual review
// flow (4c.6) end the same way for a matched transaction:
//
//   - Snapshot the money math (discount_pct_at_match, discount_cents,
//     platform_fee_cents, rebate_cents) onto matched_transactions.
//   - Set auto_approval_status to 'auto_approved' or 'manual_approved'.
//   - Move the claim to status='matched'.
//   - Add the discount to offers.monthly_spent_cents and auto-pause
//     the offer if the monthly budget is now exhausted.
//
// Centralizing here keeps both code paths consistent and means the
// money math is computed exactly once per matched transaction.

import "server-only";

import { logAuditEvent } from "@/lib/db/audit-log";
import { computeRebate } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ApprovalKind = "auto_approved" | "manual_approved";

export type ApprovalInputs = {
  matchedTransactionId: string;
  /** The matched_transactions row, already loaded. */
  amountCents: number;
  claimId: string;
  /** For manual_approved: the reviewer's user_id. Null for system. */
  reviewerUserId: string | null;
  kind: ApprovalKind;
};

export type ApprovalSnapshot = {
  discountPct: number;
  discountCents: number;
  platformFeeCents: number;
  rebateCents: number;
};

/**
 * Apply the money snapshot and downstream side-effects (claim, offer
 * budget). Returns the snapshot for the caller to log / display.
 *
 * Loads offer.discount_pct from the claim's offer at call time; the
 * value is snapshotted onto the row so later changes don't disturb
 * historical analysis.
 */
export async function applyApprovedSnapshot(
  input: ApprovalInputs,
): Promise<ApprovalSnapshot> {
  const admin = createSupabaseAdminClient();

  const { data: claim, error: claimErr } = await admin
    .from("claims")
    .select(
      `
      id, offer_id,
      offers!inner ( id, discount_pct, monthly_spent_cents, monthly_budget_cents, status )
      `,
    )
    .eq("id", input.claimId)
    .maybeSingle();
  if (claimErr || !claim) {
    throw new Error(`applyApprovedSnapshot: claim ${input.claimId} not loadable`);
  }

  const offer = claim.offers as unknown as
    | OfferRow
    | OfferRow[];
  const o = Array.isArray(offer) ? offer[0] : offer;
  if (!o) throw new Error("applyApprovedSnapshot: offer missing");

  const breakdown = computeRebate(input.amountCents, o.discount_pct);
  const snapshot: ApprovalSnapshot = {
    discountPct: o.discount_pct,
    discountCents: breakdown.discountCents,
    platformFeeCents: breakdown.platformFeeCents,
    rebateCents: breakdown.rebateCents,
  };

  const { error: updErr } = await admin
    .from("matched_transactions")
    .update({
      discount_pct_at_match: snapshot.discountPct,
      discount_cents: snapshot.discountCents,
      platform_fee_cents: snapshot.platformFeeCents,
      rebate_cents: snapshot.rebateCents,
      auto_approval_status: input.kind,
      flagged_reasons: null,
      reviewed_by_user_id: input.reviewerUserId,
      reviewed_at: input.reviewerUserId ? new Date().toISOString() : null,
    })
    .eq("id", input.matchedTransactionId);
  if (updErr) {
    throw new Error(`matched_transactions update: ${updErr.message}`);
  }

  // Race-safe claim advance — only promotes 'claimed' rows.
  await admin
    .from("claims")
    .update({ status: "matched" })
    .eq("id", input.claimId)
    .eq("status", "claimed");

  // Offer budget bookkeeping.
  const nextSpent = o.monthly_spent_cents + snapshot.discountCents;
  const shouldPause =
    o.status === "active" && nextSpent >= o.monthly_budget_cents;
  await admin
    .from("offers")
    .update({
      monthly_spent_cents: nextSpent,
      ...(shouldPause ? { status: "paused" } : {}),
    })
    .eq("id", o.id);

  if (shouldPause) {
    await logAuditEvent({
      actor: { id: "system", role: "system" },
      action: "offer.auto_paused_budget_exhausted",
      subjectType: "offer",
      subjectId: o.id,
      metadata: {
        monthly_spent_cents: nextSpent,
        monthly_budget_cents: o.monthly_budget_cents,
      },
    });
  }

  return snapshot;
}

type OfferRow = {
  id: string;
  discount_pct: number;
  monthly_spent_cents: number;
  monthly_budget_cents: number;
  status: string;
};
