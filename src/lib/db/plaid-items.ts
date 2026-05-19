// Server-only helpers for reading from `plaid_items`.
//
// `plaid_items.access_token` is stored encrypted (see
// `src/lib/crypto/plaid-token.ts`). RLS denies SELECT outright — the
// table has no SELECT policy for owners and no admin SELECT either —
// so all reads must go through the service role. We funnel them
// through this module to keep the decrypt step (and the audit
// boundary) in one place.

import "server-only";

import { decryptPlaidAccessToken } from "@/lib/crypto/plaid-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PlaidItemForUse = {
  id: string;
  user_id: string;
  plaid_item_id: string;
  institution_name: string | null;
  status: string;
  accessToken: string; // decrypted plaintext — do NOT log
};

/**
 * Look up a plaid_items row by primary key and return the decrypted
 * access_token together with non-secret metadata. Returns `null` if no
 * row matches.
 *
 * Phase 4c (transaction sync) will be the first real caller. Phase 4b
 * exposes it so the encrypt/decrypt pair is testable end-to-end and so
 * future call sites have a single, audited code path.
 */
export async function getPlaidItemForUse(
  id: string,
): Promise<PlaidItemForUse | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("plaid_items")
    .select("id, user_id, plaid_item_id, access_token, institution_name, status")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getPlaidItemForUse:", error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    plaid_item_id: data.plaid_item_id,
    institution_name: data.institution_name,
    status: data.status,
    accessToken: decryptPlaidAccessToken(data.access_token),
  };
}
