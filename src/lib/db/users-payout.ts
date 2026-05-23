// Diner payout-method state. Read/write the column the chooser screen
// at /app/rebates/setup populates ('astra' for push-to-debit-card,
// 'dwolla' for ACH to bank account). Service-role client because the
// column is on users, which RLS keeps locked down to the owner.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PayoutMethod = "astra" | "dwolla";

export async function getPayoutMethod(
  userId: string,
): Promise<PayoutMethod | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("payout_method")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("getPayoutMethod:", error);
    return null;
  }
  return (data?.payout_method as PayoutMethod | null) ?? null;
}

export async function setPayoutMethod(
  userId: string,
  method: PayoutMethod,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("users")
    .update({ payout_method: method })
    .eq("id", userId);
  if (error) throw new Error(`setPayoutMethod: ${error.message}`);
}
