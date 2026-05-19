// Admin reads for the rebates table.
//
// RLS for rebates lands in Phase 4d.1c; until then we route admin
// reads through the service-role client (admin layout already
// enforced role='admin' at the wrapper, so this is safe by virtue
// of the calling boundary).

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RebateStatus = "initiated" | "sent" | "failed" | "settled";
export type RebateProvider = "stripe" | "dwolla" | "visa_direct";

export type RebateRow = {
  id: string;
  status: RebateStatus;
  provider: RebateProvider;
  amountCents: number;
  providerTransferId: string | null;
  sentAt: string | null;
  settledAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  matchedTransactionId: string;
  diner: { displayName: string; email: string | null } | null;
  restaurant: { id: string; name: string } | null;
  cardMask: string | null;
};

/** Newest first. Limit to the most recent 200 for the admin list view. */
export async function getAllRebates(): Promise<RebateRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("rebates")
    .select(
      `
      id, status, provider, amount_cents, provider_transfer_id,
      sent_at, settled_at, error_message, created_at,
      matched_transaction_id,
      matched_transactions (
        restaurants ( id, name ),
        plaid_card_accounts (
          mask,
          plaid_items ( users ( display_name, email ) )
        )
      )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("getAllRebates:", error);
    return [];
  }
  return (data ?? []).map(rowToRebate);
}

// ====================================================================
// Internals
// ====================================================================

type DbRow = {
  id: string;
  status: RebateStatus;
  provider: RebateProvider;
  amount_cents: number;
  provider_transfer_id: string | null;
  sent_at: string | null;
  settled_at: string | null;
  error_message: string | null;
  created_at: string;
  matched_transaction_id: string;
  matched_transactions: MatchedJoin | MatchedJoin[] | null;
};

type MatchedJoin = {
  restaurants: { id: string; name: string } | { id: string; name: string }[] | null;
  plaid_card_accounts:
    | CardJoin
    | CardJoin[]
    | null;
};

type CardJoin = {
  mask: string | null;
  plaid_items:
    | { users: UserJoin | UserJoin[] | null }
    | { users: UserJoin | UserJoin[] | null }[]
    | null;
};

type UserJoin = { display_name: string; email: string | null };

function flatten<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function rowToRebate(row: DbRow): RebateRow {
  const match = flatten(row.matched_transactions);
  const restaurant = match ? flatten(match.restaurants) : null;
  const card = match ? flatten(match.plaid_card_accounts) : null;
  const item = card ? flatten(card.plaid_items) : null;
  const diner = item ? flatten(item.users) : null;

  return {
    id: row.id,
    status: row.status,
    provider: row.provider,
    amountCents: row.amount_cents,
    providerTransferId: row.provider_transfer_id,
    sentAt: row.sent_at,
    settledAt: row.settled_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    matchedTransactionId: row.matched_transaction_id,
    diner: diner
      ? { displayName: diner.display_name, email: diner.email }
      : null,
    restaurant: restaurant
      ? { id: restaurant.id, name: restaurant.name }
      : null,
    cardMask: card?.mask ?? null,
  };
}
