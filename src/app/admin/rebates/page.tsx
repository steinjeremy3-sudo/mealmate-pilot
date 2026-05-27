// Admin rebate visibility — every rebate and its Dwolla state
// (initiated → sent → settled / failed). Failed rebates can be retried.

import Link from "next/link";

import { Button, Card } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import { getAllRebates, type RebateStatus } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

import { retryRebate } from "./actions";

const STATUS_TONE: Record<RebateStatus, string> = {
  initiated: "border-border bg-bone-deep text-muted-foreground",
  sent: "border-paprika/30 bg-paprika-tint text-paprika-deep",
  settled: "border-ink/15 bg-bone-deep text-ink",
  failed: "border-destructive/40 bg-burnt/15 text-destructive",
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "initiated", label: "Initiated" },
  { key: "sent", label: "Sent" },
  { key: "settled", label: "Settled" },
  { key: "failed", label: "Failed" },
];

function StatusBadge({ status }: { status: RebateStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        STATUS_TONE[status],
      )}
    >
      {status}
    </span>
  );
}

export default async function AdminRebatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("admin");
  const { status } = await searchParams;
  const rebates = await getAllRebates();

  const counts: Record<string, number> = { all: rebates.length };
  for (const r of rebates) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const active =
    status && FILTERS.some((f) => f.key === status) ? status : "all";
  const shown =
    active === "all" ? rebates : rebates.filter((r) => r.status === active);
  const failedCount = counts.failed ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Cash back"
        title={
          <>
            Every payout
          </>
        }
        sub="Cash back moving from Mealmate to diners — via Dwolla ACH or Astra push-to-debit, per the diner's choice"
        actions={
          failedCount > 0 ? (
            <Link
              href="/admin/rebates?status=failed"
              className="inline-flex items-center gap-2 rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-paprika-deep"
            >
              <span className="size-2 rounded-full bg-white" />
              {failedCount} failed · review
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-5 px-10 py-8">
        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/admin/rebates" : `/admin/rebates?status=${f.key}`}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                active === f.key
                  ? "border-ink bg-ink text-bone"
                  : "border-border bg-transparent text-ink hover:bg-bone-deep",
              )}
            >
              {f.label}{" "}
              <span className="font-mono text-muted-foreground">
                {counts[f.key] ?? 0}
              </span>
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No cash back {active === "all" ? "yet" : `with status “${active}”`}.
          </Card>
        ) : (
          <Card flush className="overflow-hidden">
            <div className="flex items-center gap-4 border-b border-border px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              <span className="flex-1">Diner · Restaurant</span>
              <span className="w-24 text-right">Amount</span>
              <span className="w-24">Status</span>
              <span className="w-44">Transfer</span>
              <span className="w-36 text-right">—</span>
            </div>
            {shown.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base">
                    {r.diner?.displayName ?? "Unknown diner"}
                    {r.restaurant ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {r.restaurant.name}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.diner?.email ?? "no email"}
                    {r.cardMask ? ` · card ····${r.cardMask}` : ""}
                  </p>
                  {r.errorMessage ? (
                    <p className="truncate text-xs text-destructive">
                      {r.errorMessage}
                    </p>
                  ) : null}
                </div>
                <span className="w-24 text-right font-mono text-sm">
                  {centsToUsd(r.amountCents)}
                </span>
                <span className="w-24">
                  <StatusBadge status={r.status} />
                </span>
                <span className="w-44 truncate font-mono text-[11px] text-muted-foreground">
                  {r.provider}
                  {r.providerTransferId
                    ? ` · ${r.providerTransferId.slice(0, 14)}…`
                    : ""}
                </span>
                <span className="flex w-36 items-center justify-end gap-3">
                  <Link
                    href={`/admin/matches/${r.matchedTransactionId}`}
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-paprika"
                  >
                    visit →
                  </Link>
                  {r.status === "failed" ? (
                    <form action={retryRebate}>
                      <input type="hidden" name="rebate_id" value={r.id} />
                      <Button type="submit" size="sm">
                        Retry
                      </Button>
                    </form>
                  ) : null}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
