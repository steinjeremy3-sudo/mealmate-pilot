// Diner cuisine preferences — read/write users.preferred_cuisines,
// and the cuisine options for the preferences screen.
//
// Service-role client: reads/writes are scoped to the calling diner's
// own id (or are non-sensitive cuisine names), gated by requireRole.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** A diner's saved cuisine preferences (empty if none set). */
export async function getDinerCuisines(userId: string): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("preferred_cuisines")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("getDinerCuisines:", error);
    return [];
  }
  return (data.preferred_cuisines as string[] | null) ?? [];
}

/** Replace a diner's saved cuisine preferences. */
export async function setDinerCuisines(
  userId: string,
  cuisines: string[],
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("users")
    .update({ preferred_cuisines: cuisines })
    .eq("id", userId);
  if (error) throw new Error(`setDinerCuisines: ${error.message}`);
}

/** Distinct cuisines across all restaurants — the preference options. */
export async function getCuisineOptions(): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("restaurants").select("cuisine");
  if (error) {
    console.error("getCuisineOptions:", error);
    return [];
  }
  const set = new Set<string>();
  for (const r of data ?? []) {
    if (r.cuisine) set.add(r.cuisine as string);
  }
  return [...set].sort();
}
