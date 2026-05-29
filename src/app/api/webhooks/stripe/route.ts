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
import { notifyStripeAccountActive } from "@/lib/email/notifications";
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
      // Capture the prior status so we can email the merchant exactly
      // once, on the transition into 'active' (Stripe sends many
      // account.updated events).
      const { data: prior } = await supabase
        .from("restaurant_stripe_accounts")
        .select("status")
        .eq("stripe_account_id", account.id)
        .maybeSingle();
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
        if (status === "active" && prior?.status !== "active") {
          await notifyStripeActiveForRestaurant(
            supabase,
            updated[0].restaurant_id,
          );
        }
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await advanceSettlement(supabase, invoice.id, "paid");
      break;
    }
    case "invoice.payment_failed":
    case "invoice.marked_uncollectible": {
      const invoice = event.data.object as Stripe.Invoice;
      await advanceSettlement(supabase, invoice.id, "overdue");
      break;
    }
    default: {
      console.log(`[stripe-webhook] no-op for ${event.type} (${event.id})`);
    }
  }

  return new NextResponse("ok", { status: 200 });
}

/**
 * Advance a settlement to a terminal-ish state by its Stripe invoice
 * id. 'paid' also stamps paid_at. Only matches rows still in
 * 'invoiced' state — a settlement that already moved on isn't
 * clobbered by a late/duplicate event.
 */
async function advanceSettlement(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  invoiceId: string | null | undefined,
  next: "paid" | "overdue",
): Promise<void> {
  if (!invoiceId) {
    console.warn("[stripe-webhook] invoice event missing invoice id");
    return;
  }
  const updates: Record<string, unknown> = { status: next };
  if (next === "paid") updates.paid_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("settlements")
    .update(updates)
    .eq("stripe_invoice_id", invoiceId)
    .eq("status", "invoiced")
    .select("id");
  if (error) {
    console.error(`[stripe-webhook] settlement update (${invoiceId}):`, error);
    return;
  }
  if (!data || data.length === 0) {
    // No settlement for this invoice, or it already advanced. Either
    // is fine — the invoice may be unrelated to settlement (none are
    // today, but defensive) or this is a duplicate delivery.
    return;
  }
  console.log(
    `[stripe-webhook] settlement ${data[0].id} -> ${next} (invoice ${invoiceId})`,
  );
}

/**
 * Email the restaurant owner that their Stripe account is active and
 * they can publish offers. Best-effort — never throws into the webhook
 * (a 500 here would make Stripe retry the whole event).
 */
async function notifyStripeActiveForRestaurant(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  restaurantId: string,
): Promise<void> {
  try {
    const { data: r } = await supabase
      .from("restaurants")
      .select("name, users:owner_user_id ( email, display_name )")
      .eq("id", restaurantId)
      .maybeSingle();
    if (!r) return;
    const owner = Array.isArray(r.users) ? r.users[0] : r.users;
    if (!owner?.email) return;
    await notifyStripeAccountActive({
      to: owner.email,
      displayName: owner.display_name ?? null,
      restaurantName: r.name ?? "Your restaurant",
    });
  } catch (e) {
    console.error("[stripe-webhook] notify active failed:", e);
  }
}
