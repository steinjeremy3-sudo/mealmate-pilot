"use server";

// Admin approval actions for a restaurant.
//
// RLS on restaurants allows admin UPDATE via the `current_user_role() = 'admin'`
// branch of restaurants_update_owner_or_admin. We don't need the service role
// key for this — the admin's own session has the privileges.
//
// TODO(Phase 2d+): write to public.audit_log on every approve/suspend so the
// ops trail exists. Needs an audit_log INSERT policy (or a SECURITY DEFINER
// helper) — skipped here to keep this phase scoped.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function approveRestaurant(formData: FormData): Promise<void> {
  await requireRole("admin");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!restaurantId) redirect("/admin");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("restaurants")
    .update({ status: "approved" })
    .eq("id", restaurantId);

  if (error) {
    redirect(`/admin/restaurants/${restaurantId}?error=${encodeURIComponent(error.message)}`);
  }

  // Invalidate the list cache so the queue updates on next view.
  revalidatePath("/admin");
  redirect("/admin");
}
