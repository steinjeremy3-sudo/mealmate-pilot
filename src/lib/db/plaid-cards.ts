// Plaid card-account queries. RLS handles owner scoping.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlaidCardStatus = "active" | "removed";

export type PlaidCardAccount = {
  id: string;
  plaid_item_id: string;
  plaid_account_id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  brand: string | null;
  is_default: boolean;
  status: PlaidCardStatus;
  created_at: string;
  updated_at: string;
};

/** Active cards for the signed-in diner. Default first, then newest. */
export async function getMyPlaidCards(): Promise<PlaidCardAccount[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plaid_card_accounts")
    .select("*")
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyPlaidCards:", error);
    return [];
  }
  return (data ?? []) as PlaidCardAccount[];
}
