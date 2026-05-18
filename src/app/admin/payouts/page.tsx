// Admin payout queue: every restaurant with approved-but-not-yet-paid-out
// payments. Per-restaurant form to mark its pending payments as paid in
// one batch (ACH reference number / note goes in the input).

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getPendingPayoutsByRestaurant } from "@/lib/db/payments";
import { centsToUsd } from "@/lib/money";

import { markBatchPaid } from "./actions";

type SearchParams = Promise<{ error?: string; paid?: string }>;

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const { error, paid } = await searchParams;
  const rows = await getPendingPayoutsByRestaurant();

  const totalCents = rows.reduce((sum, r) => sum + r.totalCents, 0);

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Pending payouts
          </p>
          <h1 className="font-serif text-3xl font-semibold">
            {rows.length === 0 ? "Nothing pending" : centsToUsd(totalCents)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Approved payments where MealMate hasn&apos;t yet ACH&apos;d the
            restaurant. Mark a restaurant&apos;s pending payments as paid
            after sending the transfer.
          </p>
        </div>

        {paid ? (
          <p className="text-sm text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-md p-3">
            Marked paid. The restaurant&apos;s dashboard will update on its
            next load.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md p-3">
            {error}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            All caught up. New payouts will land here as diners pay.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {rows.map((r) => (
              <li key={r.restaurantId} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{r.restaurantName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.neighborhood} · {r.paymentCount} payment
                      {r.paymentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-serif text-xl font-semibold shrink-0">
                    {centsToUsd(r.totalCents)}
                  </p>
                </div>
                <form
                  action={markBatchPaid}
                  className="flex gap-2 items-center pt-2 border-t"
                >
                  <input type="hidden" name="restaurant_id" value={r.restaurantId} />
                  <input
                    type="text"
                    name="batch_ref"
                    required
                    placeholder="ACH reference / note"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Mark batch paid
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/admin"
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          ← Back to admin
        </Link>
      </div>
    </main>
  );
}
