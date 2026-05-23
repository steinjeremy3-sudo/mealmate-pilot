// Merchant settlement detail (B5) — the weekly settlement view: a
// summary, a link to pay the Stripe invoice, and the matched
// transactions behind the figure (with the matcher's confidence as
// the "why was this matched" insight).

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getSettlementDetailForMerchant } from "@/lib/db/merchant-settlements";
import { centsToUsd } from "@/lib/money";
import { classifyStripeError } from "@/lib/observability/provider-errors";
import { reportError } from "@/lib/observability/report";
import { stripe } from "@/lib/stripe";

/** Best-effort fetch of the Stripe hosted invoice page URL. */
async function hostedInvoiceUrl(invoiceId: string): Promise<string | null> {
  try {
    const inv = await stripe.invoices.retrieve(invoiceId);
    return inv.hosted_invoice_url ?? null;
  } catch (err) {
    const c = classifyStripeError(err);
    if (c.disposition === "unexpected") {
      reportError({
        scope: "merchant.settlement.hostedInvoiceUrl",
        message: c.message,
        meta: { invoiceId, code: c.code },
        cause: err,
      });
    }
    return null;
  }
}

export default async function MerchantSettlementDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("merchant");
  const { id } = await params;
  const s = await getSettlementDetailForMerchant(id);
  if (!s) notFound();

  const payUrl =
    s.stripeInvoiceId && s.status !== "paid"
      ? await hostedInvoiceUrl(s.stripeInvoiceId)
      : null;

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link
          href="/dashboard/settlements"
          className="text-sm text-muted-foreground transition-colors hover:text-orange"
        >
          ← Back to settlements
        </Link>

        <div className="space-y-1">
          <Eyebrow>Settlement · {s.status}</Eyebrow>
          <Heading as="h1" size="page">
            Week of {s.periodStart}
          </Heading>
        </div>

        {/* Summary */}
        <Card className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Total owed to MealMate
              </p>
              <p className="font-serif text-3xl font-medium text-foreground">
                {centsToUsd(s.totalDiscountCents)}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {s.transactionCount} transaction
              {s.transactionCount === 1 ? "" : "s"} ·{" "}
              {s.periodStart} → {s.periodEnd}
            </p>
          </div>
          {s.status === "paid" ? (
            <p className="border-t border-border pt-3 text-sm text-orange">
              Paid{s.paidAt ? ` ${new Date(s.paidAt).toLocaleDateString()}` : ""}.
              Thank you.
            </p>
          ) : payUrl ? (
            <a
              href={payUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-orange px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-deep"
            >
              Pay this invoice →
            </a>
          ) : s.stripeInvoiceId ? (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              Invoice {s.stripeInvoiceId} — check your email for the
              payment link.
            </p>
          ) : (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              This settlement hasn&apos;t been invoiced yet.
            </p>
          )}
        </Card>

        {/* Matched transactions */}
        <div className="space-y-3">
          <Eyebrow tone="muted">Visits</Eyebrow>
          {s.transactions.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted-foreground">
              No transactions recorded on this settlement.
            </Card>
          ) : (
            <Card flush className="divide-y divide-border overflow-hidden">
              {s.transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-4 p-4"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">
                      {t.dinerFirstName ?? "A diner"} · {t.transactionDate}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      check {centsToUsd(t.amountCents)} · confirmed from
                      &ldquo;{t.merchantNameRaw}&rdquo; ·{" "}
                      <span className="font-mono uppercase">
                        {t.matchConfidence}
                      </span>{" "}
                      confidence
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="font-medium">
                      {t.discountCents != null
                        ? centsToUsd(t.discountCents)
                        : "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      discount
                    </span>
                  </p>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
