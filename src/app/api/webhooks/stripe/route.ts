// Stripe webhook endpoint. Stripe POSTs every account event here; we
// verify the signature, dedupe by event.id (Postgres PK on stripe_events),
// then dispatch.
//
// In Phase 2d the happy-path payment flow is entirely synchronous in
// payClaim, so the webhook is largely a reconciliation safety net.
// Phase 2e+ will lean on it for async events (refunds, disputes, retries).

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Stripe needs the unparsed body to verify the signature.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // We don't have the signing secret yet (or it's not set in this env).
    // Refuse loudly so Stripe retries until we configure it.
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
    // jsonb column — passing the full event preserves Stripe's full payload
    // for future debugging / reconciliation.
    payload: event as unknown as Record<string, unknown>,
  });

  // Dispatch. In Phase 2d we just log — the payClaim server action does
  // the real DB write synchronously. Phase 2e and beyond will move work
  // here as flows become async (refunds, disputes, retried 3DS).
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      console.log(
        `[stripe-webhook] payment_intent.succeeded: ${pi.id} (claim ${pi.metadata?.claim_id ?? "?"})`,
      );
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      console.log(
        `[stripe-webhook] payment_intent.payment_failed: ${pi.id} — ${pi.last_payment_error?.message ?? "no message"}`,
      );
      break;
    }
    default: {
      // Other events arrive (charge.succeeded, etc.); we just record them
      // in stripe_events for audit and move on.
      break;
    }
  }

  return new NextResponse("ok", { status: 200 });
}
