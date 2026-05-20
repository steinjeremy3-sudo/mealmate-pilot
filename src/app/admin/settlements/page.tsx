// Admin settlement visibility (Phase 4e).
//
// Read-only list of weekly settlement batches: per restaurant, the
// period, discount total owed, transaction count, and Stripe invoice
// status. The weekly cron creates these; the Stripe webhook advances
// them invoiced → paid / overdue.

import { requireRole } from "@/lib/auth/require-role";
import { getAllSettlements } from "@/lib/db/settlements";
import { centsToUsd } from "@/lib/money";

export default async function AdminSettlementsPage() {
  await requireRole("admin");
  const settlements = await getAllSettlements();

  const owed = settlements
    .filter((s) => s.status === "invoiced" || s.status === "overdue")
    .reduce((sum, s) => sum + s.totalDiscountCents, 0);

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Settlements · weekly batches
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {settlements.length === 0
              ? "No settlements yet"
              : `${centsToUsd(owed)} outstanding`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Restaurants are invoiced weekly for the discount portion of
            their matched transactions. Cron runs Tuesdays.
          </p>
        </div>

        {settlements.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            No settlement batches have run yet.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {settlements.map((s) => (
              <li key={s.id} className="p-4">
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
                    <p className="text-xs text-muted-foreground">
                      <Badge status={s.status} />
                      {s.stripeInvoiceId ? (
                        <> · invoice {s.stripeInvoiceId.slice(0, 18)}…</>
                      ) : null}
                      {s.paidAt ? (
                        <> · paid {new Date(s.paidAt).toLocaleDateString()}</>
                      ) : null}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">
                      {centsToUsd(s.totalDiscountCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      owed to MealMate
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function Badge({ status }: { status: string }) {
  const color =
    status === "paid"
      ? "text-emerald-700"
      : status === "invoiced"
      ? "text-blue-700"
      : status === "overdue"
      ? "text-destructive"
      : "text-zinc-600";
  return <span className={`font-mono uppercase ${color}`}>{status}</span>;
}
