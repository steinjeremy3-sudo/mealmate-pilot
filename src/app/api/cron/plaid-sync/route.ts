// Vercel Cron entrypoint: Plaid transaction sync.
//
// Triggered by the schedule in vercel.json. Vercel sends a GET with
// `Authorization: Bearer ${CRON_SECRET}` — we reject anything else so
// a public attacker can't drain Plaid quota or DOS our pipeline.
//
// The work itself lives in src/lib/plaid/sync-transactions.ts so it
// can also be invoked from an admin debug button later without
// duplicating logic.

import { NextResponse, type NextRequest } from "next/server";

import { matchPendingTransactions } from "@/lib/matching/match";
import { syncAllActiveItems } from "@/lib/plaid/sync-transactions";

// Vercel-specific: Plaid SDK is Node-only (uses node-fetch internally),
// and audit logging hits the service-role client. Both rule out edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron runs every 30 min on a small pilot; per-call wall time is short
// (few Plaid API calls + DB writes). Cap at 60s to surface hangs early.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse("CRON_SECRET not configured", { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAt = Date.now();
  const results = await syncAllActiveItems();

  const ingestTotals = results.reduce(
    (acc, r) => ({
      added: acc.added + r.added,
      modified: acc.modified + r.modified,
      skippedNonFood: acc.skippedNonFood + r.skippedNonFood,
      skippedUnknownAccount:
        acc.skippedUnknownAccount + r.skippedUnknownAccount,
      errors: acc.errors + r.errors,
    }),
    {
      added: 0,
      modified: 0,
      skippedNonFood: 0,
      skippedUnknownAccount: 0,
      errors: 0,
    },
  );

  // Run the matcher in the same tick — fresh ingestion has the most
  // matchable data and the cron quota is per-route, not per-call.
  const matching = await matchPendingTransactions();

  const durationMs = Date.now() - startedAt;

  console.log(
    `[cron/plaid-sync] items=${results.length} ` +
      `added=${ingestTotals.added} modified=${ingestTotals.modified} ` +
      `skipped_non_food=${ingestTotals.skippedNonFood} ` +
      `skipped_unknown_account=${ingestTotals.skippedUnknownAccount} ` +
      `ingest_errors=${ingestTotals.errors} ` +
      `match_examined=${matching.examined} ` +
      `match_high=${matching.matchedHigh} match_medium=${matching.matchedMedium} ` +
      `match_low=${matching.matchedLow} match_unmatched=${matching.unmatched} ` +
      `match_errors=${matching.errors} duration_ms=${durationMs}`,
  );

  return NextResponse.json({
    ok: ingestTotals.errors === 0 && matching.errors === 0,
    items: results.length,
    ingest: ingestTotals,
    matching,
    durationMs,
  });
}
