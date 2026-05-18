"use server";

// Merchant publish action — flips a draft offer to live.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function publishOffer(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const offerId = String(formData.get("offer_id") ?? "");
  if (!offerId) redirect("/dashboard/offers");

  const supabase = await createSupabaseServerClient();
  // RLS lets a merchant update their own offers; if they aren't the owner
  // this is a no-op and we'll just bounce back.
  const { error } = await supabase
    .from("offers")
    .update({ status: "live" })
    .eq("id", offerId)
    .eq("status", "draft"); // only allow draft → live transition here

  if (error) {
    redirect(
      `/dashboard/offers/${offerId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "offer.published",
    subjectType: "offer",
    subjectId: offerId,
  });

  revalidatePath("/dashboard/offers");
  revalidatePath(`/dashboard/offers/${offerId}`);
  // Also invalidate the diner browse — a new live offer should show up.
  revalidatePath("/app");
  redirect(`/dashboard/offers/${offerId}`);
}
