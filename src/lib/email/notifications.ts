// Lifecycle (transactional) emails — the moments where silence makes a
// real user think the product is broken.
//
// Every function here is BEST-EFFORT: it swallows its own errors and
// never throws, so a flaky email send can never roll back the money
// move or the approval it's notifying about. sendTransactionalEmail
// itself already degrades to a console log when RESEND_API_KEY is unset.
//
// Copy follows the locked user-facing vocabulary: "cash back" + "visit",
// never "rebate" / "match" / "claim".

import "server-only";

import { sendTransactionalEmail } from "./send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Canonical app origin for links in emails (no trailing slash). */
const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://mealmatedining.app"
).replace(/\/$/, "");

/** Where internal/ops notifications land. */
const OPS_INBOX = "jeremy@mealmatedining.com";

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "Jeremy Stein" → "Jeremy"; null/empty → "there". */
function firstName(displayName: string | null | undefined): string {
  const first = (displayName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

/**
 * Diner: their cash back just left for their bank account. Fired from
 * the rebate send rail the moment a rebate flips to 'sent'. Looks up
 * the diner's email itself so the caller only needs the user id.
 */
export async function notifyCashBackSent(
  userId: string,
  amountCents: number,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("users")
      .select("email, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!data?.email) return;

    const amount = `$${(amountCents / 100).toFixed(2)}`;
    await sendTransactionalEmail({
      to: data.email,
      subject: `Your ${amount} cash back is on the way`,
      text:
        `Hi ${firstName(data.display_name)},\n\n` +
        `${amount} in cash back from your recent Mealmate visit is on ` +
        `its way to your bank account. It should land in 1–2 business ` +
        `days and show up as "Mealmate cash-back".\n\n` +
        `See your cash back any time: ${APP_URL}/app/wallet\n\n` +
        `— Mealmate`,
    });
  } catch (e) {
    console.error("[notify] cash-back-sent failed:", e);
  }
}

/**
 * Merchant: their restaurant just cleared review. Fired from the admin
 * approval action. Points them at the next step (payouts + first offer).
 */
export async function notifyRestaurantApproved(args: {
  to: string;
  displayName: string | null;
  restaurantName: string;
}): Promise<void> {
  try {
    if (!args.to) return;
    await sendTransactionalEmail({
      to: args.to,
      subject: `${args.restaurantName} is approved on Mealmate`,
      text:
        `Hi ${firstName(args.displayName)},\n\n` +
        `Good news — ${args.restaurantName} has been approved on ` +
        `Mealmate.\n\n` +
        `Two quick steps to start filling your slow hours:\n` +
        `  1. Finish setting up payouts (Stripe) so we can settle with ` +
        `you weekly.\n` +
        `  2. Publish your first offer.\n\n` +
        `Pick up where you left off: ${APP_URL}/dashboard\n\n` +
        `— Mealmate`,
    });
  } catch (e) {
    console.error("[notify] restaurant-approved failed:", e);
  }
}

/**
 * Merchant: confirmation that their restaurant application was received
 * and is in review. Fired right after they submit at onboarding.
 */
export async function notifyRestaurantSubmitted(args: {
  to: string;
  displayName: string | null;
  restaurantName: string;
}): Promise<void> {
  try {
    if (!args.to) return;
    await sendTransactionalEmail({
      to: args.to,
      subject: `We got your application for ${args.restaurantName}`,
      text:
        `Hi ${firstName(args.displayName)},\n\n` +
        `Thanks for submitting ${args.restaurantName} to Mealmate. Our ` +
        `team reviews new restaurants and typically approves within one ` +
        `business day. We'll email you the moment you're approved, with ` +
        `the next steps to set up payouts and publish your first offer.\n\n` +
        `— Mealmate`,
    });
  } catch (e) {
    console.error("[notify] restaurant-submitted failed:", e);
  }
}

/**
 * Ops: a new restaurant is waiting for approval. The actionable signal
 * for the Mealmate team — this is the moment a human needs to act.
 */
export async function notifyOpsNewRestaurant(args: {
  restaurantName: string;
  ownerEmail: string | null;
}): Promise<void> {
  try {
    await sendTransactionalEmail({
      to: OPS_INBOX,
      subject: `[mealmate] New restaurant pending: ${args.restaurantName}`,
      text:
        `A new restaurant just signed up and is waiting for approval.\n\n` +
        `Restaurant: ${args.restaurantName}\n` +
        `Owner:      ${args.ownerEmail ?? "(unknown)"}\n\n` +
        `Review + approve: ${APP_URL}/admin\n`,
      replyTo: args.ownerEmail ?? undefined,
    });
  } catch (e) {
    console.error("[notify] ops-new-restaurant failed:", e);
  }
}

/**
 * Merchant: their Stripe account just went active — they can now
 * publish offers. Fired from the account.updated webhook on the
 * pending/restricted → active transition only.
 */
export async function notifyStripeAccountActive(args: {
  to: string;
  displayName: string | null;
  restaurantName: string;
}): Promise<void> {
  try {
    if (!args.to) return;
    await sendTransactionalEmail({
      to: args.to,
      subject: `${args.restaurantName} is ready to publish offers`,
      text:
        `Hi ${firstName(args.displayName)},\n\n` +
        `Stripe has verified your account, so ${args.restaurantName} is ` +
        `fully set up. You can publish your first offer now:\n\n` +
        `${APP_URL}/dashboard/offers/new\n\n` +
        `— Mealmate`,
    });
  } catch (e) {
    console.error("[notify] stripe-account-active failed:", e);
  }
}

/**
 * Merchant: this week's settlement invoice has been issued. Fired from
 * the weekly settlement run once the Stripe invoice is sent.
 */
export async function notifySettlementInvoiced(args: {
  to: string;
  displayName: string | null;
  restaurantName: string;
  amountCents: number;
  transactionCount: number;
  dueInDays: number;
}): Promise<void> {
  try {
    if (!args.to) return;
    const visits = `${args.transactionCount} visit${args.transactionCount === 1 ? "" : "s"}`;
    await sendTransactionalEmail({
      to: args.to,
      subject: `Your Mealmate invoice — ${usd(args.amountCents)}`,
      text:
        `Hi ${firstName(args.displayName)},\n\n` +
        `This week's Mealmate settlement for ${args.restaurantName} is ` +
        `ready: ${usd(args.amountCents)} across ${visits}. Stripe has ` +
        `emailed you the invoice separately; it's due in ` +
        `${args.dueInDays} days.\n\n` +
        `See the breakdown: ${APP_URL}/dashboard/settlements\n\n` +
        `— Mealmate`,
    });
  } catch (e) {
    console.error("[notify] settlement-invoiced failed:", e);
  }
}
