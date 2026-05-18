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
