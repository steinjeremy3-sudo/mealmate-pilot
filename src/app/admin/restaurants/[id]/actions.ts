"use server";

// Admin approval actions for a restaurant.
//
// RLS on restaurants allows admin UPDATE via the `current_user_role() = 'admin'`
// branch of restaurants_update_owner_or_admin — no service role needed.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function approveRestaurant(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
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

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "restaurant.approved",
    subjectType: "restaurant",
    subjectId: restaurantId,
  });

  // Invalidate the list cache so the queue updates on next view.
  revalidatePath("/admin");
  redirect("/admin");
}
