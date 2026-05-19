// Lightweight summary of a diner's rebate state. Used by /app's
// banner to decide whether to prompt them to set up their destination.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RebateBannerSummary = {
  /** Cents waiting on a configured destination ('initiated' rows). */
  initiatedCents: number;
  /** Whether the diner has chosen a destination yet. */
  hasDestination: boolean;
};

export async function getDinerRebateBannerSummary(
  userId: string,
): Promise<RebateBannerSummary> {
  const admin = createSupabaseAdminClient();

  // Rebates in 'initiated' state for this diner. Uses the same
  // card→item→user join as the matching/send queries.
  const { data: rebates } = await admin
    .from("rebates")
    .select(
      `
      amount_cents,
      plaid_card_accounts!inner (
        plaid_items!inner ( user_id )
      )
      `,
    )
    .eq("status", "initiated")
    .eq("plaid_card_accounts.plaid_items.user_id", userId);

  const initiatedCents = (rebates ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0,
  );

  const { data: dwolla } = await admin
    .from("diner_dwolla_accounts")
    .select("default_card_funding_source_url")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    initiatedCents,
    hasDestination: !!dwolla?.default_card_funding_source_url,
  };
}
