// Admin read for the diners list. Service-role client — the /admin
// layout already enforced role='admin' at the boundary, mirroring
// the other admin-wide reads (rebates, audit log).

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DinerStatus = "active" | "suspended" | "deleted";

export type DinerRow = {
  id: string;
  displayName: string;
  email: string | null;
  status: DinerStatus;
  createdAt: string;
};

/** Every diner account, newest first. */
export async function getAllDiners(): Promise<DinerRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, display_name, email, status, created_at")
    .eq("role", "diner")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllDiners:", error);
    return [];
  }
  return (data ?? []).map((u) => ({
    id: u.id,
    displayName: u.display_name,
    email: u.email,
    status: u.status,
    createdAt: u.created_at,
  }));
}
