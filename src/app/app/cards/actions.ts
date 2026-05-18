"use server";

// Card management server actions.
//
// Lifecycle:
//   1. ensureStripeCustomer: lazily create a Stripe Customer + write its id
//      to users.stripe_customer_id. Idempotent.
//   2. createSetupIntent: returns a client_secret the client uses with
//      Stripe Elements to collect card details and confirm.
//   3. syncSavedCard: after the client confirms the SetupIntent, it sends
//      the payment_method_id back. We read its card details from Stripe
//      and upsert into our cards table.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

/**
 * Make sure the signed-in user has a Stripe Customer; return its id.
 * Creates one on first call, writes stripe_customer_id back to users.
 */
async function ensureStripeCustomer(userId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("users")
    .select("stripe_customer_id, email, display_name")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new Error("Could not load user profile.");
  }

  if (profile.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: profile.email ?? undefined,
    name: profile.display_name,
    metadata: { mealmate_user_id: userId },
  });

  const { error: updateErr } = await supabase
    .from("users")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateErr) {
    throw new Error("Could not save Stripe customer id.");
  }

  return customer.id;
}

/**
 * Create a SetupIntent for the signed-in user. Caller passes the
 * client_secret to Stripe Elements.
 */
export async function createSetupIntent(): Promise<{ clientSecret: string }> {
  const profile = await requireRole("diner");
  const customerId = await ensureStripeCustomer(profile.id);

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    // We're saving for future off-session charges (diner pays at restaurant
    // later, without re-entering the card).
    usage: "off_session",
    payment_method_types: ["card"],
  });

  if (!setupIntent.client_secret) {
    throw new Error("Stripe didn't return a client_secret.");
  }

  return { clientSecret: setupIntent.client_secret };
}

/**
 * Mirror a freshly-attached Stripe PaymentMethod into our cards table.
 * Called from the client after stripe.confirmSetup() succeeds.
 *
 * If this is the user's first card, mark it default.
 */
export async function syncSavedCard(paymentMethodId: string): Promise<void> {
  const profile = await requireRole("diner");

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.type !== "card" || !pm.card) {
    throw new Error("Only card payment methods are supported.");
  }

  const supabase = await createSupabaseServerClient();

  // First card → default. Otherwise leave default alone.
  const { count } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("status", "active");
  const isDefault = (count ?? 0) === 0;

  const { error } = await supabase.from("cards").insert({
    user_id: profile.id,
    stripe_payment_method_id: pm.id,
    last4: pm.card.last4,
    brand: pm.card.brand,
    exp_month: pm.card.exp_month,
    exp_year: pm.card.exp_year,
    is_default: isDefault,
    status: "active",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/cards");
}

/** Soft-remove a card (status='removed'). Owner-only via RLS. */
export async function removeCard(formData: FormData): Promise<void> {
  await requireRole("diner");
  const cardId = String(formData.get("card_id") ?? "");
  if (!cardId) redirect("/app/cards");

  const supabase = await createSupabaseServerClient();
  await supabase.from("cards").update({ status: "removed" }).eq("id", cardId);
  revalidatePath("/app/cards");
  redirect("/app/cards");
}

/** Flip which card is the default. */
export async function setDefaultCard(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");
  const cardId = String(formData.get("card_id") ?? "");
  if (!cardId) redirect("/app/cards");

  const supabase = await createSupabaseServerClient();
  // Unset all other defaults for this user, then set the chosen one.
  await supabase
    .from("cards")
    .update({ is_default: false })
    .eq("user_id", profile.id);
  await supabase.from("cards").update({ is_default: true }).eq("id", cardId);

  revalidatePath("/app/cards");
  redirect("/app/cards");
}
