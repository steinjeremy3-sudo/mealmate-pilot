"use server";

// Admin review actions for flagged payments.
//
// RLS policy payments_update_admin lets the admin's own session do the
// UPDATE — no service role needed.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function reviewPayment(
  formData: FormData,
  newStatus: "manual_approved" | "rejected",
): Promise<void> {
  const profile = await requireRole("admin");
  const paymentId = String(formData.get("payment_id") ?? "");
  if (!paymentId) redirect("/admin");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("payments")
    .update({
      auto_approval_status: newStatus,
      reviewed_by_user_id: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (error) {
    redirect(
      `/admin/payments/${paymentId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: newStatus === "manual_approved" ? "payment.approved" : "payment.rejected",
    subjectType: "payment",
    subjectId: paymentId,
    metadata: { new_status: newStatus },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/payments/${paymentId}`);
  redirect("/admin");
}

export async function approvePayment(formData: FormData): Promise<void> {
  return reviewPayment(formData, "manual_approved");
}

export async function rejectPayment(formData: FormData): Promise<void> {
  return reviewPayment(formData, "rejected");
}
