"use server";

// Stripe Connect onboarding for restaurants.
//
// Flow:
//   1. Merchant clicks "Set up payouts" on /dashboard.
//   2. startStripeOnboarding creates an Express Connected Account
//      (or reuses the existing one if onboarding was started but not
//      finished), then creates an AccountLink and redirects to Stripe.
//   3. Stripe hosts KYC + bank account collection.
//   4. Stripe redirects back to /dashboard/onboarding/stripe/return
//      (or /refresh if the link expired before completion).
//   5. account.updated webhook mirrors final state into
//      restaurant_stripe_accounts. The dashboard reads from there.
//
// "Connected Account" choice: Express. Stripe hosts the UI, we just
// store the id. Suitable for the pilot.

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import {
  deriveStripeAccountStatus,
  getStripeAccountForRestaurant,
} from "@/lib/db/stripe-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function startStripeOnboarding(): Promise<void> {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");
  if (restaurant.status !== "approved") {
    redirect("/dashboard?error=approval-required");
  }

  const existing = await getStripeAccountForRestaurant(restaurant.id);
  const admin = createSupabaseAdminClient();

  // Create the Stripe account if the merchant hasn't started before.
  let stripeAccountId = existing?.stripe_account_id;
  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: profile.email ?? undefined,
      // We need transfers so MealMate can later debit / invoice the
      // restaurant via Stripe Connect (Phase 4e weekly settlement).
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "company",
      metadata: {
        restaurant_id: restaurant.id,
        mealmate_user_id: profile.id,
        restaurant_name: restaurant.name,
      },
    });
    stripeAccountId = account.id;

    // Mirror the initial state via service role (no user-facing INSERT
    // policy on restaurant_stripe_accounts).
    const status = deriveStripeAccountStatus({
      detailsSubmitted: account.details_submitted ?? false,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
    });
    await admin.from("restaurant_stripe_accounts").upsert({
      restaurant_id: restaurant.id,
      stripe_account_id: stripeAccountId,
      details_submitted: account.details_submitted ?? false,
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      status,
    });

    await logAuditEvent({
      actor: { id: profile.id, role: profile.role },
      action: "stripe_account.created",
      subjectType: "restaurant",
      subjectId: restaurant.id,
      metadata: { stripe_account_id: stripeAccountId },
    });
  }

  // Always create a fresh AccountLink — they expire quickly (a few
  // minutes) and Stripe lets us regenerate at will.
  const origin = await getOrigin();
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${origin}/dashboard/onboarding/stripe/refresh`,
    return_url: `${origin}/dashboard/onboarding/stripe/return`,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}
