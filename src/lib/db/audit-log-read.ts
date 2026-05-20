// Audit-log reads for the admin viewer (A3). The writer lives in
// audit-log.ts; this is the query side. Service-role client — the
// audit_log SELECT policy is admin-only and the viewer is admin-gated.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  subjectType: string;
  subjectId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditLogFilter = {
  subjectType?: string;
  subjectId?: string;
  action?: string;
};

/** Most-recent audit entries, optionally filtered. Capped at 200. */
export async function getAuditLogEntries(
  filter: AuditLogFilter = {},
): Promise<AuditLogEntry[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("audit_log")
    .select(
      "id, actor_user_id, actor_role, action, subject_type, subject_id, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter.subjectType) query = query.eq("subject_type", filter.subjectType);
  if (filter.subjectId) query = query.eq("subject_id", filter.subjectId);
  if (filter.action) query = query.eq("action", filter.action);

  const { data, error } = await query;
  if (error) {
    console.error("getAuditLogEntries:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    actorRole: r.actor_role,
    action: r.action,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    metadata: r.metadata as Record<string, unknown> | null,
    createdAt: r.created_at,
  }));
}
