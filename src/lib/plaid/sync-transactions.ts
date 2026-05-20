// Phase 4c: Plaid transaction ingestion.
//
// Called from the cron route every 30 min (vercel.json). Walks every
// active plaid_items row, pulls new/modified transactions via Plaid's
// transactionsSync API, filters to FOOD_AND_DRINK, and upserts them
// into matched_transactions with match_confidence='none'.
//
// The matcher (Phase 4c.4) then picks up these 'none' rows and decides
// a confidence + restaurant + claim for each one.
//
// Design choices:
// - Idempotency: plaid_transaction_id is UNIQUE. Conflicts are ignored.
// - Modified: Plaid may revise a transaction after first appearance
//   (amount finalizes when it settles). We update the same row.
// - Removed: rare (Plaid retracts a transaction). For pilot we skip
//   handling — the row stays; rebate flow can decide what to do.
// - Cursor: stored on plaid_items.transactions_cursor. NULL on first
//   sync = Plaid returns full history (capped server-side).
// - Single Item sync is bounded to 10 paginated calls per run; should
//   be plenty given Plaid returns ~100/page.

import "server-only";

import { plaid } from "@/lib/plaid";
import { logAuditEvent } from "@/lib/db/audit-log";
import { getPlaidItemForUse } from "@/lib/db/plaid-items";
import { normalizeMerchantName } from "@/lib/matching/normalize";
import {
  classifyPlaidError,
  type ClassifiedError,
} from "@/lib/observability/provider-errors";
import { reportError } from "@/lib/observability/report";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  Transaction as PlaidTransaction,
  RemovedTransaction,
} from "plaid";

export type SyncItemResult = {
  itemId: string;
  added: number;
  modified: number;
  skippedNonFood: number;
  skippedUnknownAccount: number;
  errors: number;
  /** True if we saved at least one transaction or persisted a cursor. */
  cursorAdvanced: boolean;
};

const MAX_PAGES_PER_ITEM = 10;

/**
 * Sync transactions for every active Plaid Item. Returns per-item
 * results so the cron route can log a single summary line.
 */
export async function syncAllActiveItems(): Promise<SyncItemResult[]> {
  const admin = createSupabaseAdminClient();
  const { data: items, error } = await admin
    .from("plaid_items")
    .select("id")
    .eq("status", "active");
  if (error) {
    console.error("syncAllActiveItems: list items:", error);
    return [];
  }
  const out: SyncItemResult[] = [];
  for (const row of items ?? []) {
    const result = await syncItem(row.id).catch((err) => {
      console.error(`syncItem(${row.id}) threw:`, err);
      return {
        itemId: row.id,
        added: 0,
        modified: 0,
        skippedNonFood: 0,
        skippedUnknownAccount: 0,
        errors: 1,
        cursorAdvanced: false,
      } satisfies SyncItemResult;
    });
    out.push(result);
  }
  return out;
}

/**
 * Sync transactions for a single Plaid Item. Paginates until Plaid
 * reports has_more=false or we hit MAX_PAGES_PER_ITEM.
 */
export async function syncItem(plaidItemRowId: string): Promise<SyncItemResult> {
  const item = await getPlaidItemForUse(plaidItemRowId);
  if (!item) {
    throw new Error(`syncItem: plaid_items row ${plaidItemRowId} not found`);
  }

  const admin = createSupabaseAdminClient();

  // Build account_id -> plaid_card_accounts.id map (only active cards).
  const { data: cardRows, error: cardErr } = await admin
    .from("plaid_card_accounts")
    .select("id, plaid_account_id")
    .eq("plaid_item_id", item.id)
    .eq("status", "active");
  if (cardErr) {
    throw new Error(`syncItem: load card accounts: ${cardErr.message}`);
  }
  const accountIdToCard = new Map<string, string>();
  for (const c of cardRows ?? []) {
    accountIdToCard.set(c.plaid_account_id, c.id);
  }

  const result: SyncItemResult = {
    itemId: item.id,
    added: 0,
    modified: 0,
    skippedNonFood: 0,
    skippedUnknownAccount: 0,
    errors: 0,
    cursorAdvanced: false,
  };

  let cursor: string | null | undefined =
    (await fetchCursor(plaidItemRowId)) ?? undefined;
  let hasMore = true;
  let pages = 0;

  // Set if a transactionsSync call fails. We break the loop, persist
  // whatever cursor we reached (each processed page was already
  // upserted idempotently), then act on the disposition below.
  let syncFailure: ClassifiedError | null = null;

  while (hasMore && pages < MAX_PAGES_PER_ITEM) {
    pages += 1;
    let resp: Awaited<ReturnType<typeof plaid.transactionsSync>>;
    try {
      resp = await plaid.transactionsSync({
        access_token: item.accessToken,
        cursor: cursor ?? undefined,
      });
    } catch (err) {
      // Plaid failure modes handled:
      //   retryable   (429 RATE_LIMIT, PRODUCT_NOT_READY, 5xx, network
      //                timeout) — leave the item active; the next cron
      //                run retries from the same cursor.
      //   user_action (ITEM_LOGIN_REQUIRED, INVALID_CREDENTIALS) —
      //                the diner must re-link; flip the item to
      //                'error' so we stop hammering.
      //   terminal    (INVALID_ACCESS_TOKEN, ITEM_NOT_FOUND) — the
      //                Item is dead; flip to 'error'.
      //   unexpected  — reportError so a human investigates.
      syncFailure = classifyPlaidError(err);
      break;
    }

    for (const txn of resp.data.added) {
      const r = await persistTransaction(txn, accountIdToCard);
      if (r === "added") result.added += 1;
      else if (r === "skipped_non_food") result.skippedNonFood += 1;
      else if (r === "skipped_unknown_account") result.skippedUnknownAccount += 1;
      else if (r === "error") result.errors += 1;
    }
    for (const txn of resp.data.modified) {
      const r = await persistTransaction(txn, accountIdToCard);
      if (r === "added") result.modified += 1;
      else if (r === "skipped_non_food") result.skippedNonFood += 1;
      else if (r === "skipped_unknown_account") result.skippedUnknownAccount += 1;
      else if (r === "error") result.errors += 1;
    }
    // Removed: skip in pilot. Logged for awareness.
    if (resp.data.removed.length > 0) {
      logRemoved(resp.data.removed);
    }

    cursor = resp.data.next_cursor;
    hasMore = resp.data.has_more;
  }

  // Persist whatever cursor we reached — safe even on partial failure,
  // since each processed page's transactions were already upserted.
  const { error: cursorErr } = await admin
    .from("plaid_items")
    .update({ transactions_cursor: cursor })
    .eq("id", plaidItemRowId);
  if (cursorErr) {
    console.error(`syncItem: persist cursor failed:`, cursorErr);
    result.errors += 1;
  } else {
    result.cursorAdvanced = true;
  }

  // Act on a transactionsSync failure.
  if (syncFailure) {
    result.errors += 1;
    if (
      syncFailure.disposition === "user_action" ||
      syncFailure.disposition === "terminal"
    ) {
      // The Item can't be synced until the diner re-links. Flip to
      // 'error' so syncAllActiveItems (which filters status='active')
      // stops retrying it every run.
      await admin
        .from("plaid_items")
        .update({ status: "error" })
        .eq("id", plaidItemRowId);
      await logAuditEvent({
        actor: { id: "system", role: "system" },
        action: "plaid.item_errored",
        subjectType: "plaid_item",
        subjectId: item.id,
        metadata: { code: syncFailure.code, disposition: syncFailure.disposition },
      });
    } else if (syncFailure.disposition === "unexpected") {
      reportError({
        scope: "plaid.transactionsSync",
        message: `Unrecognized Plaid error syncing item: ${syncFailure.message}`,
        meta: { itemId: item.id, code: syncFailure.code, httpStatus: syncFailure.httpStatus },
      });
    } else {
      // retryable — normal operation; next cron run picks up.
      console.warn(
        `[plaid.transactionsSync] item ${item.id} retryable failure ` +
          `(${syncFailure.code}) — will retry next run`,
      );
    }
  }

  await logAuditEvent({
    actor: { id: "system", role: "system" },
    action: "plaid.sync_completed",
    subjectType: "plaid_item",
    subjectId: item.id,
    metadata: {
      added: result.added,
      modified: result.modified,
      skipped_non_food: result.skippedNonFood,
      skipped_unknown_account: result.skippedUnknownAccount,
      errors: result.errors,
      pages,
      sync_failure: syncFailure
        ? { code: syncFailure.code, disposition: syncFailure.disposition }
        : null,
    },
  });

  return result;
}

type PersistResult =
  | "added"
  | "skipped_non_food"
  | "skipped_unknown_account"
  | "error";

async function persistTransaction(
  txn: PlaidTransaction,
  accountIdToCard: Map<string, string>,
): Promise<PersistResult> {
  // 1. Food-and-drink filter. Plaid's PFC is more reliable than the
  //    legacy category[] array.
  const primary = txn.personal_finance_category?.primary;
  if (primary !== "FOOD_AND_DRINK") return "skipped_non_food";

  // 2. Skip refunds / credits (negative Plaid amounts).
  if (typeof txn.amount !== "number" || txn.amount <= 0) {
    return "skipped_non_food";
  }

  // 3. Map Plaid account_id -> our plaid_card_accounts.id.
  const cardId = accountIdToCard.get(txn.account_id);
  if (!cardId) return "skipped_unknown_account";

  const merchantNameRaw = (txn.merchant_name ?? txn.name ?? "").trim();
  if (!merchantNameRaw) return "skipped_non_food";

  const amountCents = Math.round(txn.amount * 100);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("matched_transactions").upsert(
    {
      plaid_card_account_id: cardId,
      plaid_transaction_id: txn.transaction_id,
      merchant_name_raw: merchantNameRaw,
      merchant_name_normalized: normalizeMerchantName(merchantNameRaw),
      amount_cents: amountCents,
      transaction_date: txn.date, // Plaid returns YYYY-MM-DD
      match_confidence: "none",
    },
    { onConflict: "plaid_transaction_id", ignoreDuplicates: false },
  );
  if (error) {
    console.error(
      `persistTransaction(${txn.transaction_id}):`,
      error.message,
    );
    return "error";
  }
  return "added";
}

async function fetchCursor(itemId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("plaid_items")
    .select("transactions_cursor")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) return null;
  return data.transactions_cursor ?? null;
}

function logRemoved(removed: RemovedTransaction[]) {
  // Plaid retracts a transaction (rare). Pilot decision: log only —
  // a stuck rebate is preferable to silently deleting state. Phase
  // 4c+ can grow proper handling.
  console.log(
    `plaid sync: ${removed.length} removed transaction(s); not handling in pilot`,
  );
}
