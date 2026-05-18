"use server";

// Pay action: a diner pays for an active claim using their saved card.
//
// Happy path (test mode, no 3DS):
//   1. Validate claim is active and unpaid
//   2. Look up default card + Stripe customer id
//   3. Compute price breakdown (subtotal -> discount -> fee -> total)
//   4. stripe.paymentIntents.create({ confirm: true, off_session: true })
//   5. Insert payments row
//   6. Mark claim status='consumed'
//   7. Redirect to /app/claims with a success flag
//
// 3DS / authentication_required is NOT handled in Phase 2d — we just
// surface the error. Phase 3+ will handle the off-session 3DS flow.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getMyDefaultCard } from "@/lib/db/cards";
import { getPaymentForClaim } from "@/lib/db/payments";
import { isClaimActive } from "@/lib/db/claims";
import { computePrice } from "@/lib/pricing";
import { usdToCents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { evaluateRubric } from "@/lib/rubric";

function errParam(claimId: string, message: string): string {
  return `/app/claims/${claimId}/pay?error=${encodeURIComponent(message)}`;
}

export async function payClaim(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");

  const claimId = String(formData.get("claim_id") ?? "");
  const subtotalUsd = parseFloat(String(formData.get("subtotal") ?? ""));
  if (!claimId) redirect("/app/claims");
  if (!Number.isFinite(subtotalUsd) || subtotalUsd <= 0) {
    redirect(errParam(claimId, "Enter a valid check subtotal."));
  }
  const subtotalCents = usdToCents(subtotalUsd);

  const supabase = await createSupabaseServerClient();

  // Load claim + offer + restaurant. We pull the extra offer/restaurant
  // fields (valid_*, mcc) here so the rubric evaluator further down can
  // run without a second roundtrip.
  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select(
      `*, offer:offers!offer_id(
        id, title, discount_pct, min_spend_cents,
        valid_days, valid_start_time, valid_end_time, max_claims_per_diner,
        restaurant:restaurants!restaurant_id(id, name, mcc)
      )`,
    )
    .eq("id", claimId)
    .maybeSingle();

  if (claimErr || !claim || !claim.offer) {
    redirect("/app/claims");
  }
  if (!isClaimActive(claim)) {
    redirect(errParam(claimId, "This claim is no longer active."));
  }
  if (subtotalCents < claim.offer.min_spend_cents) {
    redirect(
      errParam(claimId, "Subtotal is below the offer's minimum spend."),
    );
  }

  // Already paid? Bail.
  const existing = await getPaymentForClaim(claimId);
  if (existing) {
    redirect(`/app/claims?paid=${claimId}`);
  }

  const card = await getMyDefaultCard();
  if (!card) {
    redirect(`/app/cards/add`);
  }

  // Fetch the Stripe customer id (saved when the card was added).
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", profile.id)
    .single();
  if (userErr || !userRow?.stripe_customer_id) {
    redirect(errParam(claimId, "Card on file but no Stripe customer — re-add the card."));
  }

  const price = computePrice(subtotalCents, claim.offer.discount_pct);

  let paymentIntentId: string;
  try {
    const pi = await stripe.paymentIntents.create({
      amount: price.totalCents,
      currency: "usd",
      customer: userRow.stripe_customer_id,
      payment_method: card.stripe_payment_method_id,
      confirm: true,
      off_session: true,
      description: `MealMate · ${claim.offer.restaurant?.name ?? "Restaurant"} · ${claim.offer.title}`,
      metadata: {
        claim_id: claimId,
        offer_id: claim.offer.id,
        diner_user_id: profile.id,
      },
    });

    if (pi.status !== "succeeded") {
      // Common cases: requires_action (3DS) → not supported in Phase 2d.
      redirect(errParam(claimId, `Payment did not complete (status: ${pi.status}).`));
    }
    paymentIntentId = pi.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    redirect(errParam(claimId, message));
  }

  // ----- 6-check rubric (Phase 2e) -----
  // Count this diner's prior + current claims on this offer. Cancelled
  // claims don't count against the per-diner cap.
  const { count: dinerOfferClaims } = await supabase
    .from("claims")
    .select("*", { count: "exact", head: true })
    .eq("offer_id", claim.offer.id)
    .eq("diner_user_id", profile.id)
    .neq("status", "cancelled");

  const rubric = evaluateRubric({
    claimedAt: new Date(claim.claimed_at),
    offerValidStartTime: claim.offer.valid_start_time,
    offerValidEndTime: claim.offer.valid_end_time,
    offerValidDays: claim.offer.valid_days,
    offerMinSpendCents: claim.offer.min_spend_cents,
    offerMaxClaimsPerDiner: claim.offer.max_claims_per_diner,
    subtotalCents: price.subtotalCents,
    restaurantMcc: claim.offer.restaurant?.mcc ?? "",
    totalDinerClaimsOnOffer: dinerOfferClaims ?? 0,
    // v1 always charges the diner's own saved card, so this is implicit.
    cardBelongsToDiner: true,
  });

  // Persist the payment record. Flagged → admin review queue.
  const { error: payErr } = await supabase.from("payments").insert({
    claim_id: claimId,
    card_id: card.id,
    stripe_payment_intent_id: paymentIntentId,
    subtotal_cents: price.subtotalCents,
    discount_cents: price.discountCents,
    platform_fee_cents: price.platformFeeCents,
    total_cents: price.totalCents,
    payout_cents: price.payoutCents,
    auto_approval_status: rubric.passed ? "auto_approved" : "flagged",
    flagged_reasons: rubric.passed ? null : rubric.failedChecks,
  });

  if (payErr) {
    // We charged the card but couldn't record it. This needs the webhook
    // / admin to reconcile. Surface a clear error to the user.
    redirect(
      errParam(
        claimId,
        "Card was charged but the receipt failed to save. Ops will reach out.",
      ),
    );
  }

  // Flip the claim to consumed.
  await supabase
    .from("claims")
    .update({ status: "consumed" })
    .eq("id", claimId);

  revalidatePath("/app/claims");
  revalidatePath(`/app/claims/${claimId}`);
  redirect(`/app/claims?paid=${claimId}`);
}
