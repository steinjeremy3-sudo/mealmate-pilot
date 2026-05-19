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

  // Connect dispatch will live here. Phase 4a wires account.updated;
  // Phase 4e wires invoice.paid / invoice.payment_failed; Phase 4d
  // wires transfer.* events for rebate confirmations.
  console.log(`[stripe-webhook] received ${event.type} (${event.id})`);

  return new NextResponse("ok", { status: 200 });
}
