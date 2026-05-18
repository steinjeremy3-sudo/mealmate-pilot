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
