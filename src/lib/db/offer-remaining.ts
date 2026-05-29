// "X left" — how many redemption slots remain on a capped offer.
//
// A slot is consumed by anyone who has ACTIVATED the offer (status
// 'claimed' and not expired) or already had a confirmed visit (status
// 'matched') — i.e. activated counts even before they've paid. This
// matches getActiveClaimCount() in claims.ts; the urgency number diners
// see and the cap the merchant set are the same count.
//
// Service-role on purpose: under RLS a diner can only see their OWN
// claims, so a normal client-side count would be wrong. We only ever
// return an aggregate integer here — no individual claim data leaves
// this module — so exposing it to diners is safe.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CappedOffer = { id: string; max_claims_total: number | null };

/**
 * Remaining slots per offer. `null` means no cap (don't show a counter).
 * Never throws — on error it returns `null` for every offer so the UI
 * just omits the badge rather than breaking the page.
 */
export async function getRemainingByOffer(
  offers: CappedOffer[],
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  for (const o of offers) result.set(o.id, null);

  const capped = offers.filter((o) => o.max_claims_total != null);
  if (capped.length === 0) return result;

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("claims")
    .select("offer_id")
    .in(
      "offer_id",
      capped.map((o) => o.id),
    )
    .or(`status.eq.matched,and(status.eq.claimed,expires_at.gt.${nowIso})`);
  if (error) {
    console.error("getRemainingByOffer:", error);
    return result;
  }

  const used = new Map<string, number>();
  for (const row of data ?? []) {
    used.set(row.offer_id, (used.get(row.offer_id) ?? 0) + 1);
  }
  for (const o of capped) {
    const cap = o.max_claims_total as number;
    result.set(o.id, Math.max(0, cap - (used.get(o.id) ?? 0)));
  }
  return result;
}

/** Remaining slots for a single offer (null = no cap). */
export async function getRemainingForOffer(
  offer: CappedOffer,
): Promise<number | null> {
  return (await getRemainingByOffer([offer])).get(offer.id) ?? null;
}
