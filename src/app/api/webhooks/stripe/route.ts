// Stripe webhook endpoint.
//
// Phase 4a+ will route Stripe Connect events here (account.updated,
// invoice.paid, transfer.created, etc.) to keep our mirrors in
// restaurant_stripe_accounts + settlements + rebates in sync.
//
// Right now this is a stub: it verifies the signature, dedupes by
// event.id (Postgres PK on stripe_events), records the event, and
// no-ops on the dispatch. Switch statements get filled in as each
// sub-phase needs them.

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { deriveStripeAccountStatus } from "@/lib/db/stripe-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Signature verification failed: ${message}`, {
      status: 400,
    });
  }

  // Idempotency via stripe_events PRIMARY KEY on event.id.
  const supabase = createSupabaseAdminClient();

  const { data: seen } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) {
    return new NextResponse("ok (duplicate)", { status: 200 });
  }

  await supabase.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const status = deriveStripeAccountStatus({
        detailsSubmitted: account.details_submitted ?? false,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
      });
      // Mirror Stripe's three booleans + derived status onto our row,
      // keyed by stripe_account_id. If no matching restaurant row,
      // it's a stale account we created in a different env — log and skip.
      const { error: updateErr, data: updated } = await supabase
        .from("restaurant_stripe_accounts")
        .update({
          details_submitted: account.details_submitted ?? false,
          charges_enabled: account.charges_enabled ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
          status,
        })
        .eq("stripe_account_id", account.id)
        .select("restaurant_id");
      if (updateErr) {
        console.error(`[stripe-webhook] account.updated ${account.id}:`, updateErr);
      } else if (!updated || updated.length === 0) {
        console.warn(
          `[stripe-webhook] account.updated ${account.id} — no matching restaurant_stripe_accounts row`,
        );
      } else {
        console.log(
          `[stripe-webhook] account.updated ${account.id} -> ${status}`,
        );
      }
      break;
    }
    // Phase 4d will add transfer.* events for rebate confirmations.
    // Phase 4e will add invoice.paid / invoice.payment_failed for
    // weekly settlement collection.
    default: {
      console.log(`[stripe-webhook] no-op for ${event.type} (${event.id})`);
    }
  }

  return new NextResponse("ok", { status: 200 });
}
