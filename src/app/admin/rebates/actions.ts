"use server";

// Admin override: manually retry a rebate that failed to issue (A3).
//
// A 'failed' rebate is reset to 'initiated' (its error cleared) and
// the Dwolla send sweep is re-run. sendInitiatedRebates is idempotent
// — it only picks up 'initiated' rows — so re-running it is safe.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { sendInitiatedRebates } from "@/lib/rebates/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function retryRebate(formData: FormData): Promise<void> {
  const reviewer = await requireRole("admin");
  const rebateId = String(formData.get("rebate_id") ?? "");
  if (!rebateId) redirect("/admin/rebates");

  const admin = createSupabaseAdminClient();

  // Only retry a genuinely failed rebate — never re-touch one that's
  // already sent or settled.
  const { data: updated, error } = await admin
    .from("rebates")
    .update({ status: "initiated", error_message: null })
    .eq("id", rebateId)
    .eq("status", "failed")
    .select("id");
  if (error) {
    console.error("retryRebate: reset:", error);
    redirect("/admin/rebates");
  }
  if (!updated || updated.length === 0) {
    // Not failed (or gone) — nothing to retry.
    redirect("/admin/rebates");
  }

  await logAuditEvent({
    actor: { id: reviewer.id, role: reviewer.role },
    action: "rebate.retry_requested",
    subjectType: "rebate",
    subjectId: rebateId,
  });

  // Re-run the send sweep; idempotent (status='initiated' filter).
  await sendInitiatedRebates();

  revalidatePath("/admin/rebates");
  redirect("/admin/rebates");
}
