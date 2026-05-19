// Phase 4d.1: rebate creation.
//
// Called at the tail of applyApprovedSnapshot (src/lib/matching/approve.ts)
// for both auto- and manually-approved matches. Inserts a `rebates`
// row in status='initiated' and exits. No real money moves yet —
// Phase 4d.2 wires the Dwolla customer + funding-source + transfer
// flow once the Dwolla sandbox is set up.
//
// Idempotency: rebates.matched_transaction_id is UNIQUE. Re-running
// approval on the same match is a no-op for rebates.

import "server-only";

import { logAuditEvent } from "@/lib/db/audit-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CreatedRebate = {
  id: string;
  status: "initiated";
  amountCents: number;
};

/**
 * Create the rebates row for a just-approved matched_transactions
 * row. Returns the created row, or null if a rebate already exists
 * (idempotent re-approval).
 *
 * Reads the matched_transactions row to get plaid_card_account_id +
 * rebate_cents. Throws if those are missing (programmer error — the
 * caller should only invoke this after applyApprovedSnapshot wrote
 * the money columns).
 */
export async function createRebateForMatch(
  matchedTransactionId: string,
): Promise<CreatedRebate | null> {
  const admin = createSupabaseAdminClient();

  const { data: match, error: matchErr } = await admin
    .from("matched_transactions")
    .select("id, plaid_card_account_id, rebate_cents")
    .eq("id", matchedTransactionId)
    .maybeSingle();
  if (matchErr || !match) {
    throw new Error(
      `createRebateForMatch: matched_transactions ${matchedTransactionId} not loadable`,
    );
  }
  if (match.rebate_cents == null) {
    throw new Error(
      `createRebateForMatch: matched_transactions ${matchedTransactionId} missing rebate_cents (was it approved?)`,
    );
  }
  if (match.rebate_cents <= 0) {
    // Zero or negative rebate (e.g. tiny check where platform fee
    // exceeds discount). Don't bother creating a rebates row — the
    // diner gets nothing back. Audit the case so ops can spot it.
    await logAuditEvent({
      actor: { id: "system", role: "system" },
      action: "rebate.skipped_nonpositive",
      subjectType: "matched_transaction",
      subjectId: matchedTransactionId,
      metadata: { rebate_cents: match.rebate_cents },
    });
    return null;
  }

  const { data: inserted, error: insertErr } = await admin
    .from("rebates")
    .insert({
      matched_transaction_id: matchedTransactionId,
      plaid_card_account_id: match.plaid_card_account_id,
      amount_cents: match.rebate_cents,
      provider: "dwolla",
      status: "initiated",
    })
    .select("id, status, amount_cents")
    .maybeSingle();

  if (insertErr) {
    // 23505 is UNIQUE-violation — means a rebate row already exists.
    // That's an idempotent re-approval; not an error to surface.
    if (insertErr.code === "23505") {
      return null;
    }
    throw new Error(`createRebateForMatch: insert: ${insertErr.message}`);
  }
  if (!inserted) {
    throw new Error("createRebateForMatch: insert returned no row");
  }

  await logAuditEvent({
    actor: { id: "system", role: "system" },
    action: "rebate.initiated",
    subjectType: "rebate",
    subjectId: inserted.id,
    metadata: {
      matched_transaction_id: matchedTransactionId,
      amount_cents: inserted.amount_cents,
      provider: "dwolla",
    },
  });

  return {
    id: inserted.id,
    status: "initiated",
    amountCents: inserted.amount_cents,
  };
}
