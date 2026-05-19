// restaurant_stripe_accounts helpers. RLS-respecting reads via the
// user-scoped server client; writes happen exclusively from server
// actions / webhook via the service role admin client.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StripeAccountStatus = "pending" | "restricted" | "active";

export type RestaurantStripeAccount = {
  restaurant_id: string;
  stripe_account_id: string;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  status: StripeAccountStatus;
  created_at: string;
  updated_at: string;
};

/** The current merchant's Stripe Connect account, if onboarding has started. */
export async function getStripeAccountForRestaurant(
  restaurantId: string,
): Promise<RestaurantStripeAccount | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurant_stripe_accounts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) {
    if (error.code !== "PGRST116") {
      console.error("getStripeAccountForRestaurant:", error);
    }
    return null;
  }
  return data as RestaurantStripeAccount | null;
}

/**
 * Map Stripe's three booleans into the status enum we mirror in the DB.
 * Stripe sources (charges_enabled, payouts_enabled) trump details_submitted —
 * an account that's `details_submitted=true` but `payouts_enabled=false` is
 * `restricted` (something Stripe flagged in review).
 */
export function deriveStripeAccountStatus(args: {
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}): StripeAccountStatus {
  if (args.payoutsEnabled && args.chargesEnabled) return "active";
  if (args.detailsSubmitted) return "restricted";
  return "pending";
}
