// Phase 4e: weekly settlement run.
//
// Groups every approved-but-unsettled matched_transaction by
// restaurant, writes a settlements row, claims the transactions
// (settlement_id), and issues a Stripe Invoice the restaurant pays
// via Stripe's hosted invoice page (collection_method='send_invoice').
//
// Transaction selection is by state, not date: auto_approval_status
// in (auto_approved, manual_approved) AND settlement_id IS NULL. A
// late-approved transaction simply lands in the next week's batch.
// period_start/period_end are recorded for the invoice description
// but don't drive selection.
//
// Idempotency: settlement_id is set on each matched_transaction as
// soon as its settlement row exists, so a re-run can't double-count.
// If the Stripe call fails mid-run the settlement stays 'pending'
// with its transactions already claimed — a visible, fixable state
// in /admin/settlements rather than a silent double-charge.

import "server-only";

import { logAuditEvent } from "@/lib/db/audit-log";
import { notifySettlementInvoiced } from "@/lib/email/notifications";
import { classifyStripeError } from "@/lib/observability/provider-errors";
import { reportError } from "@/lib/observability/report";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SettlementRunSummary = {
  restaurantsSettled: number;
  totalDiscountCents: number;
  invoicesCreated: number;
  errors: number;
};

const APPROVED_STATUSES = ["auto_approved", "manual_approved"];

export async function runWeeklySettlement(): Promise<SettlementRunSummary> {
  const admin = createSupabaseAdminClient();
  const summary: SettlementRunSummary = {
    restaurantsSettled: 0,
    totalDiscountCents: 0,
    invoicesCreated: 0,
    errors: 0,
  };

  // Period window — recorded on the settlement for the invoice
  // description. Selection itself is state-based (see file header).
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 7);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);

  // Pull every approved, unsettled transaction with a restaurant.
  const { data: rows, error } = await admin
    .from("matched_transactions")
    .select("id, restaurant_id, discount_cents")
    .in("auto_approval_status", APPROVED_STATUSES)
    .is("settlement_id", null)
    .not("restaurant_id", "is", null);
  if (error) {
    console.error("runWeeklySettlement: list transactions:", error);
    return { ...summary, errors: 1 };
  }

  // Group by restaurant.
  const byRestaurant = new Map<
    string,
    { txnIds: string[]; totalDiscount: number }
  >();
  for (const r of rows ?? []) {
    if (!r.restaurant_id || r.discount_cents == null) continue;
    const entry = byRestaurant.get(r.restaurant_id) ?? {
      txnIds: [],
      totalDiscount: 0,
    };
    entry.txnIds.push(r.id);
    entry.totalDiscount += r.discount_cents;
    byRestaurant.set(r.restaurant_id, entry);
  }

  for (const [restaurantId, entry] of byRestaurant) {
    if (entry.totalDiscount <= 0) continue;
    try {
      await settleRestaurant({
        restaurantId,
        txnIds: entry.txnIds,
        totalDiscountCents: entry.totalDiscount,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
      });
      summary.restaurantsSettled += 1;
      summary.totalDiscountCents += entry.totalDiscount;
      summary.invoicesCreated += 1;
    } catch (err) {
      // A settleRestaurant failure leaves the settlement row (if it
      // was created) 'pending' with its transactions already claimed
      // — they won't be re-batched, so this always needs a human:
      // either the Stripe call failed, or a DB write did. Alert.
      const c = classifyStripeError(err);
      reportError({
        scope: "settlement.settleRestaurant",
        message: `Failed to settle restaurant — settlement may be stuck 'pending': ${c.message}`,
        meta: {
          restaurantId,
          stripeCode: c.code,
          disposition: c.disposition,
          txnCount: entry.txnIds.length,
        },
        cause: err,
      });
      summary.errors += 1;
    }
  }

  return summary;
}

async function settleRestaurant(args: {
  restaurantId: string;
  txnIds: string[];
  totalDiscountCents: number;
  periodStart: string;
  periodEnd: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();

  // 1. Create the settlement row (pending).
  const { data: settlement, error: insErr } = await admin
    .from("settlements")
    .insert({
      restaurant_id: args.restaurantId,
      period_start: args.periodStart,
      period_end: args.periodEnd,
      total_discount_cents: args.totalDiscountCents,
      transaction_count: args.txnIds.length,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !settlement) {
    throw new Error(`settlements insert: ${insErr?.message ?? "no row"}`);
  }

  // 2. Claim the transactions immediately — even if Stripe fails
  //    below, they won't be re-counted next run.
  const { error: claimErr } = await admin
    .from("matched_transactions")
    .update({ settlement_id: settlement.id })
    .in("id", args.txnIds);
  if (claimErr) {
    throw new Error(`claim transactions: ${claimErr.message}`);
  }

  // 3. Ensure the restaurant has a Stripe billing Customer.
  const customerId = await ensureBillingCustomer(args.restaurantId);

  // 4. Create + finalize + send the Stripe Invoice.
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 7,
    description: `Mealmate weekly settlement — ${args.periodStart} to ${args.periodEnd} (${args.txnIds.length} transactions)`,
    metadata: {
      settlement_id: settlement.id,
      restaurant_id: args.restaurantId,
    },
  });
  if (!invoice.id) throw new Error("Stripe invoice has no id");

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: args.totalDiscountCents,
    currency: "usd",
    description: `Discount total for ${args.txnIds.length} matched transactions`,
  });

  await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);

  // 5. Mark the settlement invoiced.
  const { error: updErr } = await admin
    .from("settlements")
    .update({
      stripe_invoice_id: invoice.id,
      status: "invoiced",
      invoiced_at: new Date().toISOString(),
    })
    .eq("id", settlement.id);
  if (updErr) {
    throw new Error(`settlement update post-invoice: ${updErr.message}`);
  }

  await logAuditEvent({
    actor: { id: "system", role: "system" },
    action: "settlement.invoiced",
    subjectType: "settlement",
    subjectId: settlement.id,
    metadata: {
      restaurant_id: args.restaurantId,
      total_discount_cents: args.totalDiscountCents,
      transaction_count: args.txnIds.length,
      stripe_invoice_id: invoice.id,
    },
  });

  // Best-effort heads-up to the merchant (Stripe also emails the invoice
  // itself). Fully guarded: a failed lookup or email must NEVER throw
  // here — the invoice is already sent and the transactions claimed, so
  // a throw would just strand a 'pending' settlement needing manual fix.
  try {
    const { data: r } = await admin
      .from("restaurants")
      .select("name, users!inner ( email, display_name )")
      .eq("id", args.restaurantId)
      .maybeSingle();
    const owner = r
      ? Array.isArray(r.users)
        ? r.users[0]
        : r.users
      : null;
    if (owner?.email) {
      await notifySettlementInvoiced({
        to: owner.email,
        displayName: owner.display_name ?? null,
        restaurantName: r?.name ?? "your restaurant",
        amountCents: args.totalDiscountCents,
        transactionCount: args.txnIds.length,
        dueInDays: 7,
      });
    }
  } catch (e) {
    console.error("[settlement] invoiced-email lookup failed:", e);
  }
}

/**
 * Look up (or lazily create) the restaurant's Stripe billing Customer.
 * Uses the restaurant name + owner email. Persisted in
 * restaurant_billing_customers so we never create duplicates.
 */
async function ensureBillingCustomer(restaurantId: string): Promise<string> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("restaurant_billing_customers")
    .select("stripe_customer_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (existing) return existing.stripe_customer_id;

  // Need restaurant name + owner email for the Customer record.
  const { data: restaurant, error: rErr } = await admin
    .from("restaurants")
    .select("id, name, owner_user_id, users!inner ( email )")
    .eq("id", restaurantId)
    .single();
  if (rErr || !restaurant) {
    throw new Error(`ensureBillingCustomer: restaurant ${restaurantId} not loadable`);
  }
  const ownerUser = Array.isArray(restaurant.users)
    ? restaurant.users[0]
    : restaurant.users;
  const ownerEmail = (ownerUser as { email: string | null } | null)?.email;

  const customer = await stripe.customers.create({
    name: restaurant.name,
    email: ownerEmail ?? undefined,
    metadata: { restaurant_id: restaurantId },
  });

  const { error: insErr } = await admin
    .from("restaurant_billing_customers")
    .insert({
      restaurant_id: restaurantId,
      stripe_customer_id: customer.id,
    });
  if (insErr) {
    // Possible race: another run created it. Re-read.
    const { data: raced } = await admin
      .from("restaurant_billing_customers")
      .select("stripe_customer_id")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (raced) return raced.stripe_customer_id;
    throw new Error(`restaurant_billing_customers insert: ${insErr.message}`);
  }

  return customer.id;
}
