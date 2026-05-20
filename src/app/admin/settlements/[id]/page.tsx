// Admin settlement detail + adjustment (A3).
//
// Shows one settlement and — unless it's already paid — lets ops
// correct the discount total for a dispute.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import { getSettlementById } from "@/lib/db/settlements";
import { centsToUsd } from "@/lib/money";

import { adjustSettlement } from "./actions";

export default async function AdminSettlementDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { error } = await searchParams;
  const s = await getSettlementById(id);
  if (!s) notFound();

  const isPaid = s.status === "paid";

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/admin/settlements"
          className="text-sm text-muted-foreground transition-colors hover:text-orange"
        >
          ← Back to settlements
        </Link>

        <div className="space-y-1">
          <Eyebrow>Settlement · {s.status}</Eyebrow>
          <Heading as="h1" size="page">
            {s.restaurant?.name ?? "Unknown restaurant"}
          </Heading>
        </div>

        <Card className="space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-muted-foreground">Period</dt>
            <dd>
              {s.periodStart} → {s.periodEnd}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-muted-foreground">Transactions</dt>
            <dd>{s.transactionCount}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-muted-foreground">Discount total owed</dt>
            <dd className="font-medium">
              {centsToUsd(s.totalDiscountCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Stripe invoice</dt>
            <dd>{s.stripeInvoiceId ?? "—"}</dd>
          </div>
        </Card>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error === "already-paid"
              ? "This settlement is paid and can no longer be adjusted."
              : "Enter a valid, non-negative dollar amount."}
          </p>
        ) : null}

        {isPaid ? (
          <Card className="text-sm text-muted-foreground">
            This settlement is paid — closed, not adjustable.
          </Card>
        ) : (
          <Card className="space-y-3">
            <Eyebrow tone="muted">Adjust discount total</Eyebrow>
            <p className="text-xs text-muted-foreground">
              For dispute corrections.
              {s.status === "invoiced"
                ? " This settlement is already invoiced — editing the total " +
                  "here corrects our ledger but does NOT change the Stripe " +
                  "invoice the restaurant received."
                : ""}
            </p>
            <form
              action={adjustSettlement}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="settlement_id" value={s.id} />
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">New total (USD)</span>
                <input
                  type="number"
                  name="total_usd"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={(s.totalDiscountCents / 100).toFixed(2)}
                  className="block w-40 rounded-lg border border-border bg-cream-soft px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
                />
              </label>
              <Button type="submit" variant="ghost">
                Save adjustment
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
