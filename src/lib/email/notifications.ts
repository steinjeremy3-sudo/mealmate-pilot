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
