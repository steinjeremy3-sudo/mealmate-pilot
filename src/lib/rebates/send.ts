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
// Both call sendInitiatedRebates() which iterates over every diner
// who has both rebates waiting and a destination configured.
//
// Idempotency: rebates.status starts as 'initiated' and we filter on
// that. Once 'sent', a row won't be re-processed. If the Dwolla call
// itself succeeds but our DB write fails, the rebate becomes a duplicate
// — but Dwolla transfers are themselves idempotent on (source, dest,
// amount, time) at the millisecond, and the chance of double-firing
// from us is low in the daily-cron pilot.

import "server-only";

import { logAuditEvent } from "@/lib/db/audit-log";
import {
  dwolla,
  getMealMateBalanceFundingUrl,
  locationOf,
} from "@/lib/dwolla";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SendRebatesSummary = {
  examined: number;
  sent: number;
  skippedNoDestination: number;
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
    failed: 0,
  };

  // Pull rebates joined to their diner (via card → item → user).
  // Postgres FK chain lets us filter to a specific diner with a
  // simple inner join when scoped.
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
    if (outcome === "sent") summary.sent += 1;
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

async function sendOne(
  rebateId: string,
  amountCents: number,
  destinationUrl: string,
): Promise<"sent" | "failed"> {
  const admin = createSupabaseAdminClient();
  const sourceUrl = await getMealMateBalanceFundingUrl();
  const amountUsd = (amountCents / 100).toFixed(2);

  try {
    const transferResp = await dwolla.post("transfers", {
      _links: {
        source: { href: sourceUrl },
        destination: { href: destinationUrl },
      },
      amount: { currency: "USD", value: amountUsd },
    });
    const transferUrl = locationOf(transferResp);

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
      throw new Error(`db update post-transfer: ${error.message}`);
    }

    await logAuditEvent({
      actor: { id: "system", role: "system" },
      action: "rebate.sent",
      subjectType: "rebate",
      subjectId: rebateId,
      metadata: {
        provider_transfer_url: transferUrl,
        amount_cents: amountCents,
      },
    });
    return "sent";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("rebates")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
      })
      .eq("id", rebateId)
      .eq("status", "initiated");

    await logAuditEvent({
      actor: { id: "system", role: "system" },
      action: "rebate.send_failed",
      subjectType: "rebate",
      subjectId: rebateId,
      metadata: { error: message.slice(0, 500) },
    });
    return "failed";
  }
}
