// Server-only helpers for diner_dwolla_accounts.
//
// One row per diner. Created lazily on the first /app/rebates/setup
// load (or first rebate trigger, if we ever auto-create). Holds the
// Dwolla customer URL and the chosen default rebate-destination
// funding source.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DinerDwollaAccount = {
  userId: string;
  dwollaCustomerUrl: string;
  defaultCardFundingSourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getDinerDwollaAccount(
  userId: string,
): Promise<DinerDwollaAccount | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("diner_dwolla_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getDinerDwollaAccount:", error);
    return null;
  }
  if (!data) return null;
  return {
    userId: data.user_id,
    dwollaCustomerUrl: data.dwolla_customer_url,
    defaultCardFundingSourceUrl: data.default_card_funding_source_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function upsertDinerDwollaCustomer(
  userId: string,
  dwollaCustomerUrl: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("diner_dwolla_accounts").upsert(
    {
      user_id: userId,
      dwolla_customer_url: dwollaCustomerUrl,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`upsertDinerDwollaCustomer: ${error.message}`);
}

export async function setDefaultCardFundingSource(
  userId: string,
  fundingSourceUrl: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("diner_dwolla_accounts")
    .update({
      default_card_funding_source_url: fundingSourceUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(`setDefaultCardFundingSource: ${error.message}`);
}
