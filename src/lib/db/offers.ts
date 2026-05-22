// Offer queries.
//
// Uses the user-scoped Supabase server client so RLS does the gating:
//   - merchants see their own (any status)
//   - diners see only live offers from approved restaurants
//   - admins see everything

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OfferStatus = "draft" | "scheduled" | "live" | "ended";

export type Offer = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string;
  discount_pct: number;
  min_check_cents: number;
  monthly_budget_cents: number;
  monthly_spent_cents: number;
  valid_days: string[];
  valid_start_time: string; // "HH:MM:SS"
  valid_end_time: string;
  blackout_dates: string[] | null;
  max_claims_total: number | null;
  max_claims_per_diner: number;
  status: OfferStatus;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OfferWithRestaurant = Offer & {
  restaurant: {
    id: string;
    name: string;
    neighborhood: string;
    cuisine: string;
    address: string;
  } | null;
};

/** Merchant: every offer they own (joined to their restaurant for display). */
export async function getOffersForMerchant(): Promise<OfferWithRestaurant[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, restaurant:restaurants!restaurant_id(id, name, neighborhood, cuisine, address)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getOffersForMerchant:", error);
    return [];
  }
  return (data ?? []) as OfferWithRestaurant[];
}

/** Single offer with its restaurant. Visibility follows RLS. */
export async function getOfferById(id: string): Promise<OfferWithRestaurant | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, restaurant:restaurants!restaurant_id(id, name, neighborhood, cuisine, address)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code !== "PGRST116") {
      console.error("getOfferById:", error);
    }
    return null;
  }
  return data as OfferWithRestaurant | null;
}

/** Diner browse: every live offer from an approved restaurant. */
export async function getLiveOffers(): Promise<OfferWithRestaurant[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, restaurant:restaurants!restaurant_id(id, name, neighborhood, cuisine, address)")
    .eq("status", "live")
    // RLS already filters to approved restaurants, but being explicit
    // here lets us order client-side without an extra join.
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getLiveOffers:", error);
    return [];
  }
  return (data ?? []) as OfferWithRestaurant[];
}
