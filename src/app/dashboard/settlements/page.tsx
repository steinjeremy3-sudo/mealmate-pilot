// Merchant settlements (B5) — the weekly invoices a restaurant owes
// Mealmate for the discounts it granted.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import {
  getSettlementsForMerchant,
  type SettlementStatus,
} from "@/lib/db/merchant-settlements";
import { centsToUsd } from "@/lib/money";

const STATUS_TONE: Record<SettlementStatus, string> = {
  pending: "border-border bg-bone-deep text-muted-foreground",
  invoiced: "border-paprika/30 bg-paprika-tint text-paprika-deep",
  paid: "border-ink/15 bg-bone-deep text-ink",
  overdue: "border-destructive/40 bg-burnt/15 text-destructive",
};

function StatusPill({ status }: { status: SettlementStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[status]}`}
    >
      {status}
    </span>
  );
}

export default async function MerchantSettlementsPage() {
  await requireRole("merchant");
  const settlements = await getSettlementsForMerchant();

  const due = settlements
    .filter((s) => s.status === "invoiced" || s.status === "overdue")
    .reduce((sum, s) => sum + s.totalDiscountCents, 0);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Settlements</Eyebrow>
          <Heading as="h1" size="page">
            {due > 0 ? (
              <>
                <em>{centsToUsd(due)}</em> due
              </>
            ) : (
              "Settlements"
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            Each week, Mealmate invoices you for the discount portion of
            the visits we confirmed at your restaurant.
          </p>
        </div>

        {settlements.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No settlements yet. Once diners start redeeming your offers,
            weekly invoices appear here.
          </Card>
        ) : (
          <Card flush className="divide-y divide-border overflow-hidden">
            {settlements.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/settlements/${s.id}`}
                className="flex items-start justify-between gap-4 p-4 transition-colors hover:bg-bone-deep"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {s.periodStart} → {s.periodEnd}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.transactionCount} visit
                    {s.transactionCount === 1 ? "" : "s"}
                  </p>
                  <p className="pt-0.5">
                    <StatusPill status={s.status} />
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">
                    {centsToUsd(s.totalDiscountCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">owed</p>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
