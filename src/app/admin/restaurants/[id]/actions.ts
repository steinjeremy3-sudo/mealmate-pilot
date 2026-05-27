"use server";

// Admin approval actions for a restaurant.
//
// Service-role client on purpose: the `authenticated` Postgres role
// has had its UPDATE privilege on `public.restaurants` revoked (see
// scripts/users-restaurants-lockdown.sql) so a merchant can't run
// `update({ status: "approved" })` against their own row and self-
// promote. Approval flows through service-role after the action
// already verified the caller is admin via requireRole.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function approveRestaurant(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!restaurantId) redirect("/admin");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
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
