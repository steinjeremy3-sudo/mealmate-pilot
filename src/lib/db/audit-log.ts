// Audit-log helper. Append-only via RLS — every server action that
// changes meaningful state (approvals, rejections, publishes) calls
// this so the ops trail exists.
//
// Best-effort: a logging failure does NOT throw or affect the calling
// action. The audit trail is observability, not correctness.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { UserRole } from "@/lib/auth/require-role";

export type AuditEvent = {
  actor: { id: string; role: UserRole };
  /** Dot-namespaced action, e.g. `restaurant.approved`, `payment.flagged`. */
  action: string;
  /** Subject table name, e.g. `restaurant`, `offer`, `payment`. */
  subjectType: string;
  /** Subject row id (uuid). */
  subjectId: string;
  /** Free-form context — what changed, prior state, etc. */
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("audit_log").insert({
      actor_user_id: event.actor.id,
      actor_role: event.actor.role,
      action: event.action,
      subject_type: event.subjectType,
      subject_id: event.subjectId,
      metadata: event.metadata ?? null,
    });
    if (error) {
      // RLS rejection or schema issue — log and move on; the calling
      // action shouldn't fail because we couldn't write the trail.
      console.error("logAuditEvent failed:", error);
    }
  } catch (err) {
    console.error("logAuditEvent threw:", err);
  }
}
