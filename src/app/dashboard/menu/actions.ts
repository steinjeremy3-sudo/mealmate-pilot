"use server";

// Merchant menu management. Both actions resolve the restaurant from
// the authenticated merchant — a client-supplied restaurant id is
// never trusted, and deletes are scoped to that restaurant.

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/require-role";
import { addMenuItem, deleteMenuItem } from "@/lib/db/menu";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { usdToCents } from "@/lib/money";

export async function createMenuItem(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) return;

  const section = String(formData.get("section") ?? "").trim() || "Menu";
  const name = String(formData.get("name") ?? "").trim();
  const priceUsd = parseFloat(String(formData.get("price") ?? ""));

  if (!name || !Number.isFinite(priceUsd) || priceUsd < 0) return;

  await addMenuItem({
    restaurantId: restaurant.id,
    section,
    name,
    priceCents: usdToCents(priceUsd),
  });
  revalidatePath("/dashboard/menu");
}

export async function removeMenuItem(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) return;

  const itemId = String(formData.get("item_id") ?? "");
  if (!itemId) return;

  await deleteMenuItem(itemId, restaurant.id);
  revalidatePath("/dashboard/menu");
}
