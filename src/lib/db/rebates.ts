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

// ====================================================================
// Diner-facing reads (B5) — a diner's own rebate history + detail.
// ====================================================================

export type DinerRebateRow = {
  id: string;
  status: RebateStatus;
  amountCents: number;
  restaurantName: string | null;
  transactionDate: string | null;
  createdAt: string;
};

export type DinerRebateDetail = DinerRebateRow & {
  errorMessage: string | null;
  cardMask: string | null;
  /** Money breakdown, snapshotted on the matched transaction. */
  checkAmountCents: number | null;
  discountPct: number | null;
  discountCents: number | null;
  platformFeeCents: number | null;
};

type DinerRebateDbRow = {
  id: string;
  status: RebateStatus;
  amount_cents: number;
  error_message: string | null;
  created_at: string;
  matched_transactions:
    | DinerMatchedJoin
    | DinerMatchedJoin[]
    | null;
  plaid_card_accounts: { mask: string | null } | { mask: string | null }[] | null;
};

type DinerMatchedJoin = {
  transaction_date: string | null;
  amount_cents: number | null;
  discount_pct_at_match: number | null;
  discount_cents: number | null;
  platform_fee_cents: number | null;
  restaurants: { name: string } | { name: string }[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const DINER_REBATE_SELECT = `
  id, status, amount_cents, error_message, created_at,
  matched_transactions (
    transaction_date, amount_cents, discount_pct_at_match,
    discount_cents, platform_fee_cents,
    restaurants ( name )
  ),
  plaid_card_accounts!inner (
    mask,
    plaid_items!inner ( user_id )
  )
`;

/** A diner's rebates, newest first. */
export async function getRebatesForDiner(
  userId: string,
): Promise<DinerRebateRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("rebates")
    .select(DINER_REBATE_SELECT)
    .eq("plaid_card_accounts.plaid_items.user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getRebatesForDiner:", error);
    return [];
  }
  return (data ?? []).map((r) => {
    const match = one(r.matched_transactions);
    return {
      id: r.id,
      status: r.status,
      amountCents: r.amount_cents,
      restaurantName: match ? one(match.restaurants)?.name ?? null : null,
      transactionDate: match?.transaction_date ?? null,
      createdAt: r.created_at,
    };
  });
}

/** One rebate for the diner who owns it (or null). */
export async function getRebateDetailForDiner(
  rebateId: string,
  userId: string,
): Promise<DinerRebateDetail | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("rebates")
    .select(DINER_REBATE_SELECT)
    .eq("id", rebateId)
    .eq("plaid_card_accounts.plaid_items.user_id", userId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("getRebateDetailForDiner:", error);
    return null;
  }
  const r = data as DinerRebateDbRow;
  const match = one(r.matched_transactions);
  const card = one(r.plaid_card_accounts);
  return {
    id: r.id,
    status: r.status,
    amountCents: r.amount_cents,
    restaurantName: match ? one(match.restaurants)?.name ?? null : null,
    transactionDate: match?.transaction_date ?? null,
    createdAt: r.created_at,
    errorMessage: r.error_message,
    cardMask: card?.mask ?? null,
    checkAmountCents: match?.amount_cents ?? null,
    discountPct: match?.discount_pct_at_match ?? null,
    discountCents: match?.discount_cents ?? null,
    platformFeeCents: match?.platform_fee_cents ?? null,
  };
}
