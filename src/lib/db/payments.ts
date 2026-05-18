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
  /** Lifetime sum of payout_cents from approved (auto or manual) payments. */
  approvedPayoutCents: number;
  /** Count of approved payments contributing to the sum. */
  approvedPaymentCount: number;
  /** Sum of payout_cents from currently-flagged payments (not yet reviewed). */
  flaggedPayoutCents: number;
  /** Count of currently-flagged payments. */
  flaggedPaymentCount: number;
};

/**
 * Merchant payout running totals. RLS
 * (payments_select_merchant_own_restaurant) already scopes payments to
 * the calling merchant — no extra filter needed.
 *
 * Phase 3 has no "marked paid" state yet: every approved payment counts
 * as pending ACH. A future admin tool will let ops flip individual
 * payments to "paid out" and the math here will split.
 */
export async function getMerchantPayoutSummary(): Promise<PayoutSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("payout_cents, auto_approval_status");

  if (error) {
    console.error("getMerchantPayoutSummary:", error);
    return {
      approvedPayoutCents: 0,
      approvedPaymentCount: 0,
      flaggedPayoutCents: 0,
      flaggedPaymentCount: 0,
    };
  }

  let approvedCents = 0;
  let approvedCount = 0;
  let flaggedCents = 0;
  let flaggedCount = 0;
  for (const p of data ?? []) {
    if (p.auto_approval_status === "auto_approved" || p.auto_approval_status === "manual_approved") {
      approvedCents += p.payout_cents;
      approvedCount += 1;
    } else if (p.auto_approval_status === "flagged") {
      flaggedCents += p.payout_cents;
      flaggedCount += 1;
    }
    // 'rejected' is dropped from both totals.
  }

  return {
    approvedPayoutCents: approvedCents,
    approvedPaymentCount: approvedCount,
    flaggedPayoutCents: flaggedCents,
    flaggedPaymentCount: flaggedCount,
  };
}
