// Admin settlement visibility (Phase 4e).
//
// Read-only list of weekly settlement batches: per restaurant, the
// period, discount total owed, transaction count, and Stripe invoice
// status. The weekly cron creates these; the Stripe webhook advances
// them invoiced → paid / overdue.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getAllSettlements } from "@/lib/db/settlements";
import { centsToUsd } from "@/lib/money";

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "border-sage/40 bg-sage-tint text-sage"
      : status === "invoiced"
        ? "border-orange/30 bg-orange-tint text-orange-deep"
        : status === "overdue"
          ? "border-destructive/40 bg-rose/15 text-destructive"
          : "border-border bg-cream-warm text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}
    >
      {status}
    </span>
  );
}

export default async function AdminSettlementsPage() {
  await requireRole("admin");
  const settlements = await getAllSettlements();

  const owed = settlements
    .filter((s) => s.status === "invoiced" || s.status === "overdue")
    .reduce((sum, s) => sum + s.totalDiscountCents, 0);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Settlements · weekly batches</Eyebrow>
          <Heading as="h1" size="page">
            {settlements.length === 0 ? (
              "No settlements yet"
            ) : (
              <>
                <em>{centsToUsd(owed)}</em> outstanding
              </>
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            Restaurants are invoiced weekly for the discount portion of
            their matched transactions. Cron runs Tuesdays.
          </p>
        </div>

        {settlements.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No settlement batches have run yet.
          </Card>
        ) : (
          <Card flush className="divide-y divide-border overflow-hidden">
            {settlements.map((s) => (
              <Link
                key={s.id}
                href={`/admin/settlements/${s.id}`}
                className="block p-4 transition-colors hover:bg-cream-warm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {s.restaurant?.name ?? "Unknown restaurant"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.periodStart} → {s.periodEnd} ·{" "}
                      {s.transactionCount} transaction
                      {s.transactionCount === 1 ? "" : "s"}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={s.status} />
                      {s.stripeInvoiceId ? (
                        <span>
                          invoice {s.stripeInvoiceId.slice(0, 18)}…
                        </span>
                      ) : null}
                      {s.paidAt ? (
                        <span>
                          · paid{" "}
                          {new Date(s.paidAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">
                      {centsToUsd(s.totalDiscountCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      owed to MealMate
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
