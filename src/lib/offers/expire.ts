// Auto-archive lapsed offers.
//
// A non-recurring offer carries an ends_at; recurring offers leave it
// null and never lapse. Once ends_at passes we flip the offer to
// status='ended' so it's genuinely archived — not just derived as
// "expired" at read time (see offerDisplayStatus). This keeps the
// stored status honest for any code that reads it raw (admin, exports,
// the matcher's status filter).
//
// Run from the cron. Idempotent: only touches still-open offers, so a
// re-run is a no-op once everything lapsed is already 'ended'.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function expireLapsedOffers(): Promise<{ expired: number }> {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await admin
    .from("offers")
    .update({ status: "ended" }) // keep the original ends_at as the record
    .in("status", ["draft", "scheduled", "live"])
    .not("ends_at", "is", null)
    .lte("ends_at", nowIso)
    .select("id");

  if (error) {
    console.error("expireLapsedOffers:", error);
    return { expired: 0 };
  }
  return { expired: data?.length ?? 0 };
}
