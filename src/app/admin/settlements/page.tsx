// Admin settlement visibility (Phase 4e).
//
// Read-only list of weekly settlement batches: per restaurant, the
// period, discount total owed, transaction count, and Stripe invoice
// status. The weekly cron creates these; the Stripe webhook advances
// them invoiced → paid / overdue.

import Link from "next/link";

import { Card } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import { getAllSettlements } from "@/lib/db/settlements";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  paid: "border-ink/15 bg-cream-warm text-ink",
  invoiced: "border-orange/30 bg-orange-tint text-orange-deep",
  overdue: "border-destructive/40 bg-rose/15 text-destructive",
  pending: "border-border bg-cream-warm text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        STATUS_TONE[status] ?? STATUS_TONE.pending,
      )}
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
    <>
      <PageHeader
        eyebrow="Settlements"
        title={
          <>
            Weekly <em>settlements.</em>
          </>
        }
        sub={`Restaurants are invoiced weekly for the discount portion of their confirmed visits — ${centsToUsd(owed)} outstanding right now.`}
      />

      <div className="px-10 py-8">
        {settlements.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No settlement batches have run yet.
          </Card>
        ) : (
          <Card flush className="overflow-hidden">
            <div className="flex items-center gap-4 border-b border-border px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              <span className="flex-1">Restaurant</span>
              <span className="w-48">Period</span>
              <span className="w-16 text-right">Txns</span>
              <span className="w-24">Status</span>
              <span className="w-28 text-right">Owed</span>
            </div>
            {settlements.map((s) => (
              <Link
                key={s.id}
                href={`/admin/settlements/${s.id}`}
                className="flex items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-cream-warm"
              >
                <span className="min-w-0 flex-1 truncate font-serif text-base">
                  {s.restaurant?.name ?? "Unknown restaurant"}
                </span>
                <span className="w-48 font-mono text-xs text-muted-foreground">
                  {s.periodStart} → {s.periodEnd}
                </span>
                <span className="w-16 text-right font-mono text-sm">
                  {s.transactionCount}
                </span>
                <span className="w-24">
                  <StatusBadge status={s.status} />
                </span>
                <span className="w-28 text-right font-mono text-sm">
                  {centsToUsd(s.totalDiscountCents)}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
