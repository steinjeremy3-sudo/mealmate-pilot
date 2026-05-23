// Admin settlement detail + adjustment (A3).
//
// Shows one settlement and — unless it's already paid — lets ops
// correct the discount total for a dispute.

import Link from "next/link";
import { notFound } from "next/navigation";

import { Button, Card, Eyebrow } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import { getSettlementById } from "@/lib/db/settlements";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

import { adjustSettlement } from "./actions";

const STATUS_TONE: Record<string, string> = {
  paid: "border-ink/15 bg-cream-warm text-ink",
  invoiced: "border-orange/30 bg-orange-tint text-orange-deep",
  overdue: "border-destructive/40 bg-rose/15 text-destructive",
  pending: "border-border bg-cream-warm text-muted-foreground",
};

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-border py-3 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

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
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/admin/settlements"
            className="transition-colors hover:text-orange"
          >
            ← Settlements
          </Link>
        }
        title={s.restaurant?.name ?? "Unknown restaurant"}
        sub={`${s.periodStart} → ${s.periodEnd}`}
        actions={
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.06em]",
              STATUS_TONE[s.status] ?? STATUS_TONE.pending,
            )}
          >
            {s.status}
          </span>
        }
      />

      <div className="px-10 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <Card className="p-6">
            <h2 className="font-serif text-xl tracking-tight">Settlement</h2>
            <dl className="mt-3 border-t border-border">
              <Fact k="Period" v={`${s.periodStart} → ${s.periodEnd}`} />
              <Fact k="Transactions" v={s.transactionCount} />
              <Fact
                k="Discount total owed"
                v={centsToUsd(s.totalDiscountCents)}
              />
              <Fact
                k="Stripe invoice"
                v={
                  s.stripeInvoiceId ? (
                    <span className="font-mono text-xs">
                      {s.stripeInvoiceId}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
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
            <Card className="space-y-3 p-6">
              <Eyebrow tone="muted">Adjust discount total</Eyebrow>
              <p className="text-xs text-muted-foreground">
                For dispute corrections.
                {s.status === "invoiced"
                  ? " This settlement is already invoiced — editing the " +
                    "total here corrects our ledger but does NOT change " +
                    "the Stripe invoice the restaurant received."
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
    </>
  );
}
