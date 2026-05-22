"use server";

// Save a diner's cuisine preferences.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { setDinerCuisines } from "@/lib/db/diner-preferences";

export async function savePreferences(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");
  const cuisines = formData
    .getAll("cuisine")
    .map(String)
    .filter(Boolean);

  await setDinerCuisines(profile.id, cuisines);

  revalidatePath("/app");
  revalidatePath("/app/profile/preferences");
  redirect("/app/profile");
}
