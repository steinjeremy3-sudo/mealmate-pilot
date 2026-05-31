// Statement-descriptor learning loop.
//
// The matcher (match.ts) treats restaurants.statement_descriptors as a
// high-precision fast-path: if an incoming Plaid string matches one, we
// pin the restaurant with certainty. Those descriptors are SEEDED by the
// merchant at onboarding — but merchants often don't know their exact
// descriptor, mistype it, or switch processors and go stale.
//
// So we also LEARN them: every time a match is confirmed (auto-approved
// or manually approved — see approve.ts), we feed the transaction's real
// merchant string back in here. If it's a genuinely new variant for that
// restaurant, we append it. Over time the set converges on the real
// descriptors with no merchant effort, and the seed is just a cold start.
//
// Best-effort: this never throws into the approval path. A learning miss
// just means we don't get the fast-path on the next identical descriptor.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { descriptorMatches, normalizeMerchantName } from "./normalize";

/**
 * Cap per restaurant so a noisy stream of variants can't grow the array
 * unbounded. Keeps the most recent — newer descriptors reflect the
 * current processor/branding. Plenty for the handful of real variants a
 * single venue produces across banks.
 */
const MAX_DESCRIPTORS = 10;

/**
 * Append the matched transaction's merchant string to the restaurant's
 * descriptor set, unless an existing descriptor already covers it.
 *
 * @param restaurantId    the confirmed restaurant
 * @param merchantNameRaw the raw Plaid merchant string from the txn
 */
export async function learnDescriptorFromMatch(
  restaurantId: string,
  merchantNameRaw: string,
): Promise<void> {
  try {
    const incomingNorm = normalizeMerchantName(merchantNameRaw);
    if (!incomingNorm) return;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("restaurants")
      .select("statement_descriptors")
      .eq("id", restaurantId)
      .maybeSingle();
    if (error || !data) return;

    const existing: string[] = data.statement_descriptors ?? [];

    // Already covered by a descriptor on file? (Truncation-tolerant, so
    // a broader existing descriptor absorbs a narrower new sighting.)
    const known = existing.some((d) =>
      descriptorMatches(incomingNorm, normalizeMerchantName(d)),
    );
    if (known) return;

    // Store the RAW string (good for merchant display / editing); the
    // matcher normalizes on read.
    const next = [...existing, merchantNameRaw].slice(-MAX_DESCRIPTORS);

    const { error: updErr } = await admin
      .from("restaurants")
      .update({ statement_descriptors: next })
      .eq("id", restaurantId);
    if (updErr) {
      console.error("learnDescriptorFromMatch: update:", updErr);
    }
  } catch (err) {
    // Never let a learning failure break the approval it rode in on.
    console.error("learnDescriptorFromMatch:", err);
  }
}
