"use server";

// Admin override: adjust a weekly settlement's discount total (A3).
//
// Rare — for dispute corrections. Only a settlement that isn't yet
// 'paid' can be adjusted. NOTE: if the settlement is already
// 'invoiced', editing the figure here does NOT change the Stripe
// invoice the restaurant received — that would need the invoice
// voided + reissued on Stripe's side. For pilot this is a ledger
// correction; the UI says so.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { usdToCents } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function adjustSettlement(formData: FormData): Promise<void> {
  const reviewer = await requireRole("admin");
  const settlementId = String(formData.get("settlement_id") ?? "");
  const newTotalUsd = Number(formData.get("total_usd"));
  if (!settlementId) redirect("/admin/settlements");
  if (!Number.isFinite(newTotalUsd) || newTotalUsd < 0) {
    redirect(`/admin/settlements/${settlementId}?error=bad-amount`);
  }

  const admin = createSupabaseAdminClient();
  const { data: current, error: loadErr } = await admin
    .from("settlements")
    .select("id, status, total_discount_cents")
    .eq("id", settlementId)
    .maybeSingle();
  if (loadErr || !current) {
    console.error("adjustSettlement: load:", loadErr);
    redirect("/admin/settlements");
  }
  if (current.status === "paid") {
    // A paid settlement is closed — don't rewrite history.
    redirect(`/admin/settlements/${settlementId}?error=already-paid`);
  }

  const newTotalCents = usdToCents(newTotalUsd);
  const { error: updErr } = await admin
    .from("settlements")
    .update({ total_discount_cents: newTotalCents })
    .eq("id", settlementId)
    .neq("status", "paid"); // race-safe
  if (updErr) {
    console.error("adjustSettlement: update:", updErr);
    redirect("/admin/settlements");
  }

  await logAuditEvent({
    actor: { id: reviewer.id, role: reviewer.role },
    action: "settlement.adjusted",
    subjectType: "settlement",
    subjectId: settlementId,
    metadata: {
      previous_total_cents: current.total_discount_cents,
      new_total_cents: newTotalCents,
    },
  });

  revalidatePath(`/admin/settlements/${settlementId}`);
  revalidatePath("/admin/settlements");
  redirect(`/admin/settlements/${settlementId}`);
}
