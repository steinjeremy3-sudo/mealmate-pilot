// Menu reads/writes. Service-role client — the diner menu screen and
// the merchant menu manager. Writes are scoped to a restaurant id the
// caller already resolved from the authenticated merchant.
//
// Discounts are applied to the WHOLE check, never to specific items —
// the menu_items.discount_eligible column on the table is a vestige
// from an earlier draft and is no longer read or written.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MenuItem = {
  id: string;
  restaurantId: string;
  section: string;
  name: string;
  priceCents: number;
};

/** A restaurant's menu items, ordered by section then creation. */
export async function getMenuForRestaurant(
  restaurantId: string,
): Promise<MenuItem[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("menu_items")
    .select("id, restaurant_id, section, name, price_cents, created_at")
    .eq("restaurant_id", restaurantId)
    .order("section", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getMenuForRestaurant:", error);
    return [];
  }
  return (data ?? []).map((m) => ({
    id: m.id,
    restaurantId: m.restaurant_id,
    section: m.section,
    name: m.name,
    priceCents: m.price_cents,
  }));
}

/** Group a (section-ordered) item list into sections, order preserved. */
export function groupBySection(
  items: MenuItem[],
): { section: string; items: MenuItem[] }[] {
  const map = new Map<string, MenuItem[]>();
  for (const item of items) {
    const arr = map.get(item.section) ?? [];
    arr.push(item);
    map.set(item.section, arr);
  }
  return [...map.entries()].map(([section, items]) => ({ section, items }));
}

export async function addMenuItem(args: {
  restaurantId: string;
  section: string;
  name: string;
  priceCents: number;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("menu_items").insert({
    restaurant_id: args.restaurantId,
    section: args.section,
    name: args.name,
    price_cents: args.priceCents,
  });
  if (error) throw new Error(`addMenuItem: ${error.message}`);
}

/** Delete one menu item — scoped to its restaurant as a safety net. */
export async function deleteMenuItem(
  itemId: string,
  restaurantId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("menu_items")
    .delete()
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);
  if (error) throw new Error(`deleteMenuItem: ${error.message}`);
}
