"use server";

// Diner claim actions (other than pay, which has its own folder).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function cancelClaim(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");
  const claimId = String(formData.get("claim_id") ?? "");
  if (!claimId) redirect("/app/claims");

  const supabase = await createSupabaseServerClient();

  // RLS (claims_update_diner_own) restricts UPDATE to the diner's own
  // claims. The .eq("status", "claimed") guard prevents cancelling a
  // claim that's already consumed / expired / cancelled.
  const { error } = await supabase
    .from("claims")
    .update({ status: "cancelled" })
    .eq("id", claimId)
    .eq("status", "claimed");

  if (error) {
    redirect(`/app/claims?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "claim.cancelled",
    subjectType: "claim",
    subjectId: claimId,
  });

  revalidatePath("/app/claims");
  revalidatePath("/app");
  redirect("/app/claims");
}
