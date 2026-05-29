// Restaurant queries.
//
// Uses the user-scoped Supabase server client so every read respects RLS.
// Admin queries (e.g. getPendingRestaurants) rely on the admin RLS policy
// — they only return rows when called from an admin session.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RestaurantStatus = "pending" | "approved" | "suspended";

export type Restaurant = {
  id: string;
  owner_user_id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  cuisine: string;
  mcc: string;
  photo_url: string | null;
  status: RestaurantStatus;
  created_at: string;
  updated_at: string;
};

export type RestaurantWithOwner = Restaurant & {
  owner: { email: string | null; display_name: string } | null;
};

/** A merchant's own restaurant (or null if they haven't onboarded). */
export async function getRestaurantForOwner(userId: string): Promise<Restaurant | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    // PGRST116 = no rows, fine. Anything else is unexpected — log and return null.
    if (error.code !== "PGRST116") {
      console.error("getRestaurantForOwner:", error);
    }
    return null;
  }
  return data as Restaurant | null;
}

/** Admin-only: every restaurant in the queue waiting for approval. */
export async function getPendingRestaurants(): Promise<RestaurantWithOwner[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*, owner:users!owner_user_id(email, display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPendingRestaurants:", error);
    return [];
  }
  return (data ?? []) as RestaurantWithOwner[];
}

/** Admin or owner: a single restaurant by id. */
export async function getRestaurantById(id: string): Promise<RestaurantWithOwner | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*, owner:users!owner_user_id(email, display_name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("getRestaurantById:", error);
    }
    return null;
  }
  return data as RestaurantWithOwner | null;
}

/** Admin-only: every restaurant, any status, newest first. */
export async function getAllRestaurants(): Promise<RestaurantWithOwner[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*, owner:users!owner_user_id(email, display_name)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllRestaurants:", error);
    return [];
  }
  return (data ?? []) as RestaurantWithOwner[];
}
