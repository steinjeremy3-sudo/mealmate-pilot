"use server";

// Diner claim action.
//
// Pre-flight checks (in app code; not all enforceable cleanly via RLS):
//   - Offer is live, restaurant is approved              (RLS also blocks)
//   - Diner doesn't already have an active claim         (per-diner cap)
//   - Total active claims < max_claims_total if set      (offer cap)
//
// Race conditions: two simultaneous claims could squeak past the caps.
// Acceptable at pilot scale; revisit with a SECURITY DEFINER function or
// a unique constraint when volume justifies the complexity.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveClaimCount,
  getActiveClaimForOffer,
} from "@/lib/db/claims";
import { getOfferById } from "@/lib/db/offers";

/** How long a claim is valid before it auto-expires (read-side only). */
const CLAIM_TTL_MS = 60 * 60 * 1000; // 1 hour

function errParam(offerId: string, message: string): string {
  return `/app/offers/${offerId}?error=${encodeURIComponent(message)}`;
}

export async function claimOffer(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");
  const offerId = String(formData.get("offer_id") ?? "");
  if (!offerId) redirect("/app");

  const offer = await getOfferById(offerId);
  if (!offer || offer.status !== "live") {
    redirect(errParam(offerId, "This offer is no longer available."));
  }

  // Per-diner cap: diners default to max_claims_per_diner=1, meaning
  // one ACTIVE claim at a time. Expired/cancelled claims don't count —
  // a diner who let theirs expire can re-claim.
  const existing = await getActiveClaimForOffer(offerId);
  if (existing) {
    redirect(errParam(offerId, "You already have an active claim on this offer."));
  }

  // Total cap (if set): refuse if the offer is sold out.
  if (offer.max_claims_total != null) {
    const activeCount = await getActiveClaimCount(offerId);
    if (activeCount >= offer.max_claims_total) {
      redirect(errParam(offerId, "This offer is fully claimed right now."));
    }
  }

  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS).toISOString();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("claims").insert({
    offer_id: offerId,
    diner_user_id: profile.id,
    expires_at: expiresAt,
    status: "claimed",
  });

  if (error) {
    redirect(errParam(offerId, error.message));
  }

  revalidatePath("/app/claims");
  revalidatePath(`/app/offers/${offerId}`);
  redirect("/app/claims");
}
