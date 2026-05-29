// Phase 4d.2: actually push money via Dwolla.
//
// createRebateForMatch (Phase 4d.1) creates a row in 'initiated'
// status. This module moves rebates from 'initiated' → 'sent' by
// POSTing a Dwolla transfer.
//
// Called from:
//   - Cron route (right after auto-approval) — catches rebates earned
//     after the diner already configured their destination.
//   - /app/rebates/setup actions.ts after the diner attaches a funding
//     source — catches rebates earned BEFORE setup.
//
// Idempotency: rebates.status starts as 'initiated' and we filter on
// that. Once 'sent', a row won't be re-processed.
//
// Dwolla failure handling (A1):
//   retryable (429, 5xx, network) — leave the rebate 'initiated' so
//     the next run retries; counted as `deferred`, not `failed`.
//   terminal / user_action (ValidationError, closed account) — mark
//     the rebate 'failed' with the error.
//   unexpected (InsufficientFunds — the Mealmate balance is dry — or
//     any unrecognized code) — mark 'failed' AND reportError so a
//     human investigates.
//   DB write failure AFTER a successful transfer — money moved but our
//     record didn't: always reportError.

import "server-only";

import { logAuditEvent } from "@/lib/db/audit-log";
import { notifyCashBackSent } from "@/lib/email/notifications";
import {
  dwolla,
  getMealMateBalanceFundingUrl,
  locationOf,
} from "@/lib/dwolla";
import { classifyDwollaError } from "@/lib/observability/provider-errors";
import { reportError } from "@/lib/observability/report";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SendRebatesSummary = {
  examined: number;
  sent: number;
  skippedNoDestination: number;
  /** Transient Dwolla failure — left 'initiated' for the next run. */
  deferred: number;
  failed: number;
};

/**
 * Sweep every 'initiated' rebate row. For ones whose diner has a
 * funding source configured, attempt the Dwolla transfer.
 *
 * @param dinerUserId — if provided, scope the sweep to that diner.
 *                      Used by the setup-page server action so it
 *                      only triggers the specific diner's backlog.
 */
export async function sendInitiatedRebates(args: {
  dinerUserId?: string;
} = {}): Promise<SendRebatesSummary> {
  const admin = createSupabaseAdminClient();
  const summary: SendRebatesSummary = {
    examined: 0,
    sent: 0,
    skippedNoDestination: 0,
    deferred: 0,
    failed: 0,
  };

  let query = admin
    .from("rebates")
    .select(
      `
      id, amount_cents,
      plaid_card_accounts!inner (
        plaid_items!inner ( user_id )
      )
      `,
    )
    .eq("status", "initiated");

  if (args.dinerUserId) {
    query = query.eq(
      "plaid_card_accounts.plaid_items.user_id",
      args.dinerUserId,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("sendInitiatedRebates: list:", error);
    return { ...summary, failed: 1 };
  }

  for (const row of data ?? []) {
    summary.examined += 1;
    const cards = Array.isArray(row.plaid_card_accounts)
      ? row.plaid_card_accounts[0]
      : row.plaid_card_accounts;
    const items = cards
      ? Array.isArray(cards.plaid_items)
        ? cards.plaid_items[0]
        : cards.plaid_items
      : null;
    const userId = items?.user_id;
    if (!userId) {
      summary.failed += 1;
      continue;
    }

    const destinationUrl = await loadDestination(userId);
    if (!destinationUrl) {
      summary.skippedNoDestination += 1;
      continue;
    }

    const outcome = await sendOne(row.id, row.amount_cents, destinationUrl);
    if (outcome === "sent") {
      summary.sent += 1;
      // Best-effort heads-up to the diner. Never blocks the sweep.
      await notifyCashBackSent(userId, row.amount_cents);
    } else if (outcome === "deferred") summary.deferred += 1;
    else summary.failed += 1;
  }

  return summary;
}

async function loadDestination(userId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("diner_dwolla_accounts")
    .select("default_card_funding_source_url")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.default_card_funding_source_url ?? null;
}

type SendOutcome = "sent" | "deferred" | "failed";

async function sendOne(
  rebateId: string,
  amountCents: number,
  destinationUrl: string,
): Promise<SendOutcome> {
  const admin = createSupabaseAdminClient();
  const amountUsd = (amountCents / 100).toFixed(2);

  // 1. The Dwolla boundary: resolve our balance + create the transfer.
  let transferUrl: string;
  try {
    const sourceUrl = await getMealMateBalanceFundingUrl();
    const transferResp = await dwolla.post("transfers", {
      _links: {
        source: { href: sourceUrl },
        destination: { href: destinationUrl },
      },
      amount: { currency: "USD", value: amountUsd },
    });
    transferUrl = locationOf(transferResp);
  } catch (err) {
    const c = classifyDwollaError(err);
    if (c.disposition === "retryable") {
      // Transient — leave the rebate 'initiated'; the next run retries.
      console.warn(
        `[rebate.send] rebate ${rebateId} deferred (${c.code}) — will retry`,
      );
      return "deferred";
    }
    // terminal / user_action / unexpected → mark the rebate failed.
    await admin
      .from("rebates")
      .update({
        status: "failed",
        error_message: `${c.code}: ${c.message}`.slice(0, 500),
      })
      .eq("id", rebateId)
      .eq("status", "initiated");
    await logAuditEvent({
      actor: { id: "system", role: "system" },
      action: "rebate.send_failed",
      subjectType: "rebate",
      subjectId: rebateId,
      metadata: { code: c.code, disposition: c.disposition },
    });
    if (c.disposition === "unexpected") {
      reportError({
        scope: "rebate.send",
        message: `Unexpected Dwolla failure issuing rebate: ${c.message}`,
        meta: { rebateId, code: c.code, httpStatus: c.httpStatus },
      });
    }
    return "failed";
  }

  // 2. Transfer created. Persist 'sent'. A DB failure here means money
  //    moved but our record didn't — always alert.
  const { error } = await admin
    .from("rebates")
    .update({
      status: "sent",
      provider_transfer_id: transferUrl,
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", rebateId)
    .eq("status", "initiated"); // race-safe — don't clobber a later state
  if (error) {
    reportError({
      scope: "rebate.send",
      message:
        "Dwolla transfer created but the rebate row failed to update — " +
        "money moved without a matching 'sent' record",
      meta: { rebateId, transferUrl },
      cause: error,
    });
    return "failed";
  }

  await logAuditEvent({
    actor: { id: "system", role: "system" },
    action: "rebate.sent",
    subjectType: "rebate",
    subjectId: rebateId,
    metadata: { provider_transfer_url: transferUrl, amount_cents: amountCents },
  });
  return "sent";
}
