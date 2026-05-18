// Claim queries. RLS-respecting via the user-scoped Supabase client.
//
// Active claim definition: status='claimed' AND expires_at > now().
// We don't run a background job to flip status='expired'; the read-side
// just treats stale claims as inactive. Cron/auto-expire arrives in
// Phase 2d when we wire payments + a webhook handler.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClaimStatus = "claimed" | "consumed" | "expired" | "cancelled";

export type Claim = {
  id: string;
  offer_id: string;
  diner_user_id: string;
  claimed_at: string;
  expires_at: string;
  status: ClaimStatus;
  created_at: string;
  updated_at: string;
};

export type ClaimWithOffer = Claim & {
  offer: {
    id: string;
    title: string;
    discount_pct: number;
    min_spend_cents: number;
    valid_days: string[];
    valid_start_time: string;
    valid_end_time: string;
    restaurant: {
      id: string;
      name: string;
      neighborhood: string;
      address: string;
    } | null;
  } | null;
};

/** Diner: every claim they've made, newest first. Caller filters by activeness. */
export async function getClaimsForDiner(): Promise<ClaimWithOffer[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("claims")
    .select(
      `*, offer:offers!offer_id(
        id, title, discount_pct, min_spend_cents,
        valid_days, valid_start_time, valid_end_time,
        restaurant:restaurants!restaurant_id(id, name, neighborhood, address)
      )`,
    )
    .order("claimed_at", { ascending: false });
  if (error) {
    console.error("getClaimsForDiner:", error);
    return [];
  }
  return (data ?? []) as ClaimWithOffer[];
}

/**
 * The diner's currently-active claim on this offer, if any.
 * Used to decide whether to show the Claim button.
 */
export async function getActiveClaimForOffer(offerId: string): Promise<Claim | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("offer_id", offerId)
    .eq("diner_user_id", user.id)
    .eq("status", "claimed")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("getActiveClaimForOffer:", error);
    }
    return null;
  }
  return data as Claim | null;
}

/** Count of currently-active claims on an offer (used for max_claims_total cap). */
export async function getActiveClaimCount(offerId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("claims")
    .select("*", { count: "exact", head: true })
    .eq("offer_id", offerId)
    .eq("status", "claimed")
    .gt("expires_at", new Date().toISOString());
  if (error) {
    console.error("getActiveClaimCount:", error);
    return 0;
  }
  return count ?? 0;
}

/** Is this claim currently active (claimed + not yet expired)? */
export function isClaimActive(claim: Pick<Claim, "status" | "expires_at">): boolean {
  return claim.status === "claimed" && new Date(claim.expires_at) > new Date();
}

/** Human-readable "expires in 23 min" for an active claim. */
export function expiresInMinutes(claim: Pick<Claim, "expires_at">): number {
  const ms = new Date(claim.expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}

// ----------------------------------------------------------------
// Merchant-side queries
// ----------------------------------------------------------------

export type MerchantClaimRow = {
  id: string;
  claimed_at: string;
  expires_at: string;
  status: ClaimStatus;
  offer: { id: string; title: string; discount_pct: number } | null;
  diner: { display_name: string; email: string | null } | null;
};

/**
 * Merchant's "tonight" view: claims made TODAY for offers from this
 * merchant's restaurant. RLS (claims_select_merchant_own_restaurant)
 * already scopes to the merchant; we just filter by claimed_at >= start
 * of today (server's local TZ, fine for pilot).
 */
export async function getTodaysClaimsForMerchant(): Promise<MerchantClaimRow[]> {
  const supabase = await createSupabaseServerClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("claims")
    .select(
      `id, claimed_at, expires_at, status,
       offer:offers!offer_id(id, title, discount_pct),
       diner:users!diner_user_id(display_name, email)`,
    )
    .gte("claimed_at", startOfToday.toISOString())
    .order("claimed_at", { ascending: true });

  if (error) {
    console.error("getTodaysClaimsForMerchant:", error);
    return [];
  }
  // Supabase's untyped client returns FK-joined fields as arrays even
  // for one-to-one relationships. They are actually scalar objects at
  // runtime, so we widen through unknown.
  return (data ?? []) as unknown as MerchantClaimRow[];
}
