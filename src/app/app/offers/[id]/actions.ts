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
import { getDinerDwollaAccount } from "@/lib/db/diner-dwolla";
import { getOfferById } from "@/lib/db/offers";
import { getMyPlaidCards } from "@/lib/db/plaid-cards";
import { getPayoutMethod } from "@/lib/db/users-payout";
import { isOfferAvailableNow } from "@/lib/offers/availability";

/** How long a claim is valid before it auto-expires (read-side only). */
const CLAIM_TTL_MS = 60 * 60 * 1000; // 1 hour

function errParam(offerId: string, message: string): string {
  return `/app/offers/${offerId}/claim?error=${encodeURIComponent(message)}`;
}

export async function claimOffer(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");
  const offerId = String(formData.get("offer_id") ?? "");
  if (!offerId) redirect("/app");

  const offer = await getOfferById(offerId);
  if (!offer || offer.status !== "live") {
    redirect(errParam(offerId, "This offer is no longer available."));
  }
  // Defense-in-depth: an offer is only claimable while it's actually in
  // its current window (same check the diner browse + matcher use). A
  // direct/stale-tab POST outside the window — or after the end date,
  // before the expire cron flips status — must not create a dead claim.
  if (!isOfferAvailableNow(offer)) {
    redirect(
      errParam(offerId, "This offer isn't available right now — check its days and hours."),
    );
  }

  // Pre-flight: a diner can only earn cash back if a card is linked
  // (so Plaid can confirm the visit) AND a payout destination is set
  // (so we have somewhere to send the cash back). The /claim page
  // already presents a friendly "finish setup" CTA before reaching
  // this action — this check is defense-in-depth so the action can't
  // be hit directly.
  const [cards, payoutMethod, dwolla] = await Promise.all([
    getMyPlaidCards(),
    getPayoutMethod(profile.id),
    getDinerDwollaAccount(profile.id),
  ]);
  if (cards.length === 0) {
    redirect(errParam(offerId, "Link a card before activating an offer."));
  }
  const hasPayoutDestination =
    payoutMethod === "astra" ||
    payoutMethod === "dwolla" ||
    !!dwolla?.defaultCardFundingSourceUrl;
  if (!hasPayoutDestination) {
    redirect(
      errParam(offerId, "Choose where your cash back lands before activating."),
    );
  }

  // Per-diner cap: diners default to max_claims_per_diner=1, meaning
  // one ACTIVE claim at a time. Expired/cancelled claims don't count —
  // a diner who let theirs expire can re-claim.
  const existing = await getActiveClaimForOffer(offerId);
  if (existing) {
    redirect(errParam(offerId, "You already have an active offer here."));
  }

  // Total cap (if set): refuse if the offer is sold out.
  if (offer.max_claims_total != null) {
    const activeCount = await getActiveClaimCount(offerId);
    if (activeCount >= offer.max_claims_total) {
      redirect(errParam(offerId, "This offer is fully booked right now."));
    }
  }

  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS).toISOString();

  const supabase = await createSupabaseServerClient();
  const { data: claim, error } = await supabase
    .from("claims")
    .insert({
      offer_id: offerId,
      diner_user_id: profile.id,
      expires_at: expiresAt,
      status: "claimed",
    })
    .select("id")
    .single();

  if (error || !claim) {
    redirect(errParam(offerId, error?.message ?? "Couldn't activate this offer."));
  }

  revalidatePath("/app/claims");
  revalidatePath("/app/wallet");
  revalidatePath(`/app/offers/${offerId}`);
  // Land on the claim detail in its just-placed success state.
  redirect(`/app/claims/${claim.id}?placed=1`);
}
