// Payment queries. RLS-respecting.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AutoApprovalStatus =
  | "auto_approved"
  | "flagged"
  | "rejected"
  | "manual_approved";

export type Payment = {
  id: string;
  claim_id: string;
  card_id: string;
  stripe_payment_intent_id: string;
  subtotal_cents: number;
  discount_cents: number;
  platform_fee_cents: number;
  total_cents: number;
  payout_cents: number;
  auto_approval_status: AutoApprovalStatus;
  flagged_reasons: string[] | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  paid_out_at: string | null;
  payout_batch_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentWithRelations = Payment & {
  claim: {
    id: string;
    claimed_at: string;
    diner: { id: string; email: string | null; display_name: string } | null;
    offer: {
      id: string;
      title: string;
      discount_pct: number;
      restaurant: { id: string; name: string; neighborhood: string } | null;
    } | null;
  } | null;
};

/** Payment row for a given claim, if it exists. */
export async function getPaymentForClaim(claimId: string): Promise<Payment | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("claim_id", claimId)
    .maybeSingle();
  if (error) {
    if (error.code !== "PGRST116") {
      console.error("getPaymentForClaim:", error);
    }
    return null;
  }
  return data as Payment | null;
}

const RELATIONS_SELECT = `
  *,
  claim:claims!claim_id(
    id, claimed_at,
    diner:users!diner_user_id(id, email, display_name),
    offer:offers!offer_id(
      id, title, discount_pct,
      restaurant:restaurants!restaurant_id(id, name, neighborhood)
    )
  )
`;

/** Admin queue: every flagged payment, newest first. */
export async function getFlaggedPayments(): Promise<PaymentWithRelations[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select(RELATIONS_SELECT)
    .eq("auto_approval_status", "flagged")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getFlaggedPayments:", error);
    return [];
  }
  return (data ?? []) as PaymentWithRelations[];
}

/** Full payment with claim/diner/offer/restaurant for the admin review page. */
export async function getPaymentByIdWithRelations(id: string): Promise<PaymentWithRelations | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select(RELATIONS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code !== "PGRST116") {
      console.error("getPaymentByIdWithRelations:", error);
    }
    return null;
  }
  return data as PaymentWithRelations | null;
}

// ----------------------------------------------------------------
// Merchant payout summary
// ----------------------------------------------------------------

export type PayoutSummary = {
  /** Approved + not yet paid out — sitting in the queue awaiting ACH. */
  pendingPayoutCents: number;
  pendingPaymentCount: number;
  /** Approved + already ACH'd. Lifetime running total. */
  paidOutPayoutCents: number;
  paidOutPaymentCount: number;
  /** Flagged + waiting for admin review (not yet contributing to either). */
  flaggedPayoutCents: number;
  flaggedPaymentCount: number;
};

/**
 * Merchant payout running totals. RLS
 * (payments_select_merchant_own_restaurant) already scopes payments to
 * the calling merchant — no extra filter needed.
 *
 * Splits approved payments into "pending ACH" (paid_out_at IS NULL) vs
 * "paid out" (paid_out_at IS NOT NULL).
 */
export async function getMerchantPayoutSummary(): Promise<PayoutSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("payout_cents, auto_approval_status, paid_out_at");

  if (error) {
    console.error("getMerchantPayoutSummary:", error);
    return {
      pendingPayoutCents: 0,
      pendingPaymentCount: 0,
      paidOutPayoutCents: 0,
      paidOutPaymentCount: 0,
      flaggedPayoutCents: 0,
      flaggedPaymentCount: 0,
    };
  }

  let pendingCents = 0;
  let pendingCount = 0;
  let paidOutCents = 0;
  let paidOutCount = 0;
  let flaggedCents = 0;
  let flaggedCount = 0;

  for (const p of data ?? []) {
    if (p.auto_approval_status === "auto_approved" || p.auto_approval_status === "manual_approved") {
      if (p.paid_out_at == null) {
        pendingCents += p.payout_cents;
        pendingCount += 1;
      } else {
        paidOutCents += p.payout_cents;
        paidOutCount += 1;
      }
    } else if (p.auto_approval_status === "flagged") {
      flaggedCents += p.payout_cents;
      flaggedCount += 1;
    }
    // 'rejected' is dropped from all totals.
  }

  return {
    pendingPayoutCents: pendingCents,
    pendingPaymentCount: pendingCount,
    paidOutPayoutCents: paidOutCents,
    paidOutPaymentCount: paidOutCount,
    flaggedPayoutCents: flaggedCents,
    flaggedPaymentCount: flaggedCount,
  };
}

// ----------------------------------------------------------------
// Admin payout queue
// ----------------------------------------------------------------

export type PendingPayoutByRestaurant = {
  restaurantId: string;
  restaurantName: string;
  neighborhood: string;
  totalCents: number;
  paymentCount: number;
};

/**
 * Admin queue: every approved-but-not-yet-paid-out payment grouped by
 * restaurant. Used by /admin/payouts to drive the mark-as-paid action.
 */
export async function getPendingPayoutsByRestaurant(): Promise<PendingPayoutByRestaurant[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      `payout_cents,
       claim:claims!inner(
         offer:offers!inner(
           restaurant:restaurants!inner(id, name, neighborhood)
         )
       )`,
    )
    .in("auto_approval_status", ["auto_approved", "manual_approved"])
    .is("paid_out_at", null);

  if (error) {
    console.error("getPendingPayoutsByRestaurant:", error);
    return [];
  }

  // Supabase typing returns nested objects as arrays; widen through
  // unknown so we can flatten them safely.
  type Row = {
    payout_cents: number;
    claim: {
      offer: { restaurant: { id: string; name: string; neighborhood: string } };
    };
  };
  const rows = (data ?? []) as unknown as Row[];

  const byRestaurant = new Map<string, PendingPayoutByRestaurant>();
  for (const row of rows) {
    const r = row.claim?.offer?.restaurant;
    if (!r) continue;
    const existing =
      byRestaurant.get(r.id) ?? {
        restaurantId: r.id,
        restaurantName: r.name,
        neighborhood: r.neighborhood,
        totalCents: 0,
        paymentCount: 0,
      };
    existing.totalCents += row.payout_cents;
    existing.paymentCount += 1;
    byRestaurant.set(r.id, existing);
  }
  return Array.from(byRestaurant.values()).sort(
    (a, b) => b.totalCents - a.totalCents,
  );
}
