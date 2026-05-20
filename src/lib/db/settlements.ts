// Admin reads for the settlements table.
//
// Service-role client — settlements RLS (Phase 4e) admits owner +
// admin SELECT, but the admin section already gates on requireRole,
// and the cron/webhook writes need service role anyway, so reads here
// route through admin for consistency.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SettlementStatus = "pending" | "invoiced" | "paid" | "overdue";

export type SettlementRow = {
  id: string;
  restaurant: { id: string; name: string } | null;
  periodStart: string;
  periodEnd: string;
  totalDiscountCents: number;
  transactionCount: number;
  stripeInvoiceId: string | null;
  status: SettlementStatus;
  invoicedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

/** All settlements, newest first. */
export async function getAllSettlements(): Promise<SettlementRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("settlements")
    .select(
      `
      id, period_start, period_end, total_discount_cents,
      transaction_count, stripe_invoice_id, status,
      invoiced_at, paid_at, created_at,
      restaurants ( id, name )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("getAllSettlements:", error);
    return [];
  }
  return (data ?? []).map(rowToSettlement);
}

/** A single settlement by id, for the detail / adjustment view. */
export async function getSettlementById(
  id: string,
): Promise<SettlementRow | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("settlements")
    .select(
      `
      id, period_start, period_end, total_discount_cents,
      transaction_count, stripe_invoice_id, status,
      invoiced_at, paid_at, created_at,
      restaurants ( id, name )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("getSettlementById:", error);
    return null;
  }
  return rowToSettlement(data);
}

type SettlementDbRow = {
  id: string;
  period_start: string;
  period_end: string;
  total_discount_cents: number;
  transaction_count: number;
  stripe_invoice_id: string | null;
  status: SettlementStatus;
  invoiced_at: string | null;
  paid_at: string | null;
  created_at: string;
  restaurants:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

function rowToSettlement(row: SettlementDbRow): SettlementRow {
  const restaurant = Array.isArray(row.restaurants)
    ? row.restaurants[0]
    : row.restaurants;
  return {
    id: row.id,
    restaurant: restaurant
      ? { id: restaurant.id, name: restaurant.name }
      : null,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalDiscountCents: row.total_discount_cents,
    transactionCount: row.transaction_count,
    stripeInvoiceId: row.stripe_invoice_id,
    status: row.status,
    invoicedAt: row.invoiced_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}
