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
import { notifyRestaurantApproved } from "@/lib/email/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function approveRestaurant(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!restaurantId) redirect("/admin");

  const admin = createSupabaseAdminClient();

  // Pull the restaurant + owner first so we can (a) only email on a real
  // pending→approved transition (not a re-approve) and (b) address the
  // merchant by name.
  const { data: before } = await admin
    .from("restaurants")
    .select("status, name, owner_user_id, users:owner_user_id (email, display_name)")
    .eq("id", restaurantId)
    .maybeSingle();

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

  // Notify the merchant — only on a genuine transition into approved.
  if (before && before.status !== "approved") {
    const owner = Array.isArray(before.users) ? before.users[0] : before.users;
    if (owner?.email) {
      await notifyRestaurantApproved({
        to: owner.email,
        displayName: owner.display_name ?? null,
        restaurantName: before.name ?? "Your restaurant",
      });
    }
  }

  // Invalidate the list cache so the queue updates on next view.
  revalidatePath("/admin");
  redirect("/admin");
}
