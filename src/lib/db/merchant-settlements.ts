// Merchant-facing settlement reads (B5).
//
// Uses the user-scoped server client so RLS does the restaurant
// scoping: the settlements policy (owner-or-admin) limits a merchant
// to their own restaurant's settlements, and the matched_transactions
// merchant policy limits the detail's transaction list the same way.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SettlementStatus = "pending" | "invoiced" | "paid" | "overdue";

export type MerchantSettlementRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalDiscountCents: number;
  transactionCount: number;
  status: SettlementStatus;
  stripeInvoiceId: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type MerchantSettlementTxn = {
  id: string;
  dinerFirstName: string | null;
  transactionDate: string;
  amountCents: number;
  discountCents: number | null;
  matchConfidence: string;
  merchantNameRaw: string;
};

export type MerchantSettlementDetail = MerchantSettlementRow & {
  transactions: MerchantSettlementTxn[];
};

/** Every settlement for the calling merchant's restaurant, newest first. */
export async function getSettlementsForMerchant(): Promise<
  MerchantSettlementRow[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("settlements")
    .select(
      "id, period_start, period_end, total_discount_cents, transaction_count, status, stripe_invoice_id, paid_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getSettlementsForMerchant:", error);
    return [];
  }
  return (data ?? []).map(toRow);
}

/** One settlement (RLS-scoped to the merchant) + its matched transactions. */
export async function getSettlementDetailForMerchant(
  id: string,
): Promise<MerchantSettlementDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: s, error } = await supabase
    .from("settlements")
    .select(
      "id, period_start, period_end, total_discount_cents, transaction_count, status, stripe_invoice_id, paid_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !s) {
    if (error) console.error("getSettlementDetailForMerchant:", error);
    return null;
  }

  const { data: txns, error: txnErr } = await supabase
    .from("matched_transactions")
    .select(
      `
      id, transaction_date, amount_cents, discount_cents,
      match_confidence, merchant_name_raw,
      claims ( diner:users!claims_diner_user_id_users_id_fk ( display_name ) )
      `,
    )
    .eq("settlement_id", id)
    .order("transaction_date", { ascending: true });
  if (txnErr) {
    console.error("getSettlementDetailForMerchant txns:", txnErr);
  }

  return {
    ...toRow(s),
    transactions: (txns ?? []).map((t) => {
      const claim = Array.isArray(t.claims) ? t.claims[0] : t.claims;
      const diner = claim
        ? Array.isArray(claim.diner)
          ? claim.diner[0]
          : claim.diner
        : null;
      const fullName = (diner as { display_name?: string } | null)
        ?.display_name;
      return {
        id: t.id,
        dinerFirstName: fullName ? fullName.split(/\s+/)[0] : null,
        transactionDate: t.transaction_date,
        amountCents: t.amount_cents,
        discountCents: t.discount_cents,
        matchConfidence: t.match_confidence,
        merchantNameRaw: t.merchant_name_raw,
      };
    }),
  };
}

type SettlementDbRow = {
  id: string;
  period_start: string;
  period_end: string;
  total_discount_cents: number;
  transaction_count: number;
  status: SettlementStatus;
  stripe_invoice_id: string | null;
  paid_at: string | null;
  created_at: string;
};

function toRow(s: SettlementDbRow): MerchantSettlementRow {
  return {
    id: s.id,
    periodStart: s.period_start,
    periodEnd: s.period_end,
    totalDiscountCents: s.total_discount_cents,
    transactionCount: s.transaction_count,
    status: s.status,
    stripeInvoiceId: s.stripe_invoice_id,
    paidAt: s.paid_at,
    createdAt: s.created_at,
  };
}

// ====================================================================
// Merchant dashboard — recent matched transactions
// ====================================================================

export type MerchantMatchRow = {
  id: string;
  transactionDate: string;
  amountCents: number;
  discountCents: number | null;
  matchConfidence: string;
  merchantNameRaw: string;
  offerTitle: string | null;
  /** Diner initials, when the merchant can read the name; else null. */
  dinerInitials: string | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  return letters || "·";
}

/**
 * Recent matched transactions for the calling merchant's restaurant.
 * RLS (matched_transactions_select_merchant) does the scoping.
 */
export async function getRecentMatchedTransactionsForMerchant(
  limit = 25,
): Promise<MerchantMatchRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("matched_transactions")
    .select(
      `
      id, transaction_date, amount_cents, discount_cents,
      match_confidence, merchant_name_raw,
      claims (
        offers ( title ),
        diner:users!claims_diner_user_id_users_id_fk ( display_name )
      )
      `,
    )
    .order("transaction_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRecentMatchedTransactionsForMerchant:", error);
    return [];
  }
  return (data ?? []).map((t) => {
    const claim = one(t.claims);
    const offer = claim ? one(claim.offers) : null;
    const diner = claim ? one(claim.diner) : null;
    const name = (diner as { display_name?: string } | null)?.display_name;
    return {
      id: t.id,
      transactionDate: t.transaction_date,
      amountCents: t.amount_cents,
      discountCents: t.discount_cents,
      matchConfidence: t.match_confidence,
      merchantNameRaw: t.merchant_name_raw,
      offerTitle: offer?.title ?? null,
      dinerInitials: name ? initialsOf(name) : null,
    };
  });
}
