"use server";

// Approve / reject server actions for the admin review queue.
//
// approveMatch: same downstream side-effects as auto-approval — money
// snapshot, claim → matched, offer budget bookkeeping — but with
// auto_approval_status='manual_approved' and the reviewer recorded.
//
// rejectMatch: drops the row out of the queue with
// auto_approval_status='rejected'. No money snapshot, no claim
// promotion. The claim stays in 'claimed' until it expires or gets
// matched by a different transaction.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { applyApprovedSnapshot } from "@/lib/matching/approve";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function approveMatch(formData: FormData): Promise<void> {
  const reviewer = await requireRole("admin");
  const matchId = String(formData.get("match_id") ?? "");
  if (!matchId) redirect("/admin/matches");

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("matched_transactions")
    .select("id, claim_id, amount_cents, auto_approval_status, reviewed_at")
    .eq("id", matchId)
    .maybeSingle();
  if (error || !row) {
    console.error("approveMatch: load row:", error);
    redirect("/admin/matches");
  }
  if (row.reviewed_at) {
    // Already decided by another admin tab — bounce to detail.
    redirect(`/admin/matches/${matchId}`);
  }
  if (!row.claim_id) {
    // UI disables this case, but defend belt-and-suspenders.
    throw new Error("Cannot approve a match without an attached claim.");
  }

  const snapshot = await applyApprovedSnapshot({
    matchedTransactionId: row.id,
    amountCents: row.amount_cents,
    claimId: row.claim_id,
    reviewerUserId: reviewer.id,
    kind: "manual_approved",
  });

  await logAuditEvent({
    actor: { id: reviewer.id, role: reviewer.role },
    action: "matching.manual_approved",
    subjectType: "matched_transaction",
    subjectId: row.id,
    metadata: {
      claim_id: row.claim_id,
      discount_cents: snapshot.discountCents,
      platform_fee_cents: snapshot.platformFeeCents,
      rebate_cents: snapshot.rebateCents,
    },
  });

  revalidatePath("/admin/matches");
  redirect("/admin/matches");
}

export async function rejectMatch(formData: FormData): Promise<void> {
  const reviewer = await requireRole("admin");
  const matchId = String(formData.get("match_id") ?? "");
  if (!matchId) redirect("/admin/matches");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("matched_transactions")
    .update({
      auto_approval_status: "rejected",
      reviewed_by_user_id: reviewer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .is("reviewed_at", null);
  if (error) {
    console.error("rejectMatch: update:", error);
    redirect("/admin/matches");
  }

  await logAuditEvent({
    actor: { id: reviewer.id, role: reviewer.role },
    action: "matching.rejected",
    subjectType: "matched_transaction",
    subjectId: matchId,
  });

  revalidatePath("/admin/matches");
  redirect("/admin/matches");
}
