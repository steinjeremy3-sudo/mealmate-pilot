"use server";

// Admin "Mark batch as paid" action.
//
// Effect: every approved-but-not-yet-paid-out payment for the given
// restaurant gets paid_out_at=now + payout_batch_id=<reference>.
//
// We do this in two steps:
//   1. SELECT to find the matching payment ids (RLS-aware, scopes to
//      admins via payments_select_admin)
//   2. UPDATE those ids (RLS-aware via payments_update_admin)
//
// Two steps because Supabase JS can't express a WHERE-on-joined-column
// UPDATE in one call. Acceptable at pilot scale; a Postgres function
// would tighten it later.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function markBatchPaid(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const batchRef = String(formData.get("batch_ref") ?? "").trim();

  if (!restaurantId) redirect("/admin/payouts");
  if (!batchRef) {
    redirect(`/admin/payouts?error=${encodeURIComponent("Batch reference is required.")}`);
  }

  const supabase = await createSupabaseServerClient();

  // Step 1: find pending payment ids for this restaurant.
  const { data: payments, error: selectErr } = await supabase
    .from("payments")
    .select(
      `id, claim:claims!inner(offer:offers!inner(restaurant_id))`,
    )
    .in("auto_approval_status", ["auto_approved", "manual_approved"])
    .is("paid_out_at", null);

  if (selectErr) {
    redirect(`/admin/payouts?error=${encodeURIComponent(selectErr.message)}`);
  }

  type Row = { id: string; claim: { offer: { restaurant_id: string } } };
  const ids = ((payments ?? []) as unknown as Row[])
    .filter((p) => p.claim?.offer?.restaurant_id === restaurantId)
    .map((p) => p.id);

  if (ids.length === 0) {
    redirect(
      `/admin/payouts?error=${encodeURIComponent("No pending payments for this restaurant.")}`,
    );
  }

  // Step 2: mark them paid.
  const { error: updateErr } = await supabase
    .from("payments")
    .update({
      paid_out_at: new Date().toISOString(),
      payout_batch_id: batchRef,
    })
    .in("id", ids);

  if (updateErr) {
    redirect(`/admin/payouts?error=${encodeURIComponent(updateErr.message)}`);
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "payout.batch_paid",
    subjectType: "restaurant",
    subjectId: restaurantId,
    metadata: {
      batch_ref: batchRef,
      payment_count: ids.length,
      payment_ids: ids,
    },
  });

  revalidatePath("/admin/payouts");
  revalidatePath("/admin");
  // Also invalidate merchant dashboards (best-effort — each one will see
  // updated numbers on their next request).
  revalidatePath("/dashboard");
  redirect(`/admin/payouts?paid=${restaurantId}`);
}
