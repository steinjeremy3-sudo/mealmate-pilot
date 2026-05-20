// Admin rebate visibility — read-only list of every rebate and its
// Dwolla state (initiated → sent → settled / failed).

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import { getAllRebates } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";

import { retryRebate } from "./actions";

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "settled"
      ? "border-sage/40 bg-sage-tint text-sage"
      : status === "sent"
        ? "border-orange/30 bg-orange-tint text-orange-deep"
        : status === "failed"
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

export default async function AdminRebatesPage() {
  await requireRole("admin");
  const rebates = await getAllRebates();

  const counts = rebates.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Rebates · Dwolla</Eyebrow>
          <Heading as="h1" size="page">
            {rebates.length === 0 ? (
              "No rebates yet"
            ) : (
              <>
                <em>{rebates.length}</em> total
              </>
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            {counts.initiated ? `${counts.initiated} initiated · ` : ""}
            {counts.sent ? `${counts.sent} sent · ` : ""}
            {counts.settled ? `${counts.settled} settled · ` : ""}
            {counts.failed ? `${counts.failed} failed` : ""}
            {Object.keys(counts).length === 0 ? "—" : ""}
          </p>
        </div>

        {rebates.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No rebates created yet. They&apos;ll show up once approved
            matches start landing.
          </Card>
        ) : (
          <Card flush className="divide-y divide-border overflow-hidden">
            {rebates.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {r.diner?.displayName ?? "Unknown diner"}
                      {r.restaurant ? <> · {r.restaurant.name}</> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.diner?.email ?? "no email"}
                      {r.cardMask ? <> · card ····{r.cardMask}</> : null}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={r.status} />
                      <span>provider {r.provider}</span>
                      {r.providerTransferId ? (
                        <span>
                          · transfer {r.providerTransferId.slice(0, 12)}…
                        </span>
                      ) : null}
                    </p>
                    {r.errorMessage ? (
                      <p className="text-xs text-destructive">
                        {r.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    <p className="font-medium">
                      {centsToUsd(r.amountCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      created{" "}
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    <Link
                      href={`/admin/matches/${r.matchedTransactionId}`}
                      className="block text-xs text-muted-foreground underline underline-offset-4 hover:text-orange"
                    >
                      match details →
                    </Link>
                    {r.status === "failed" ? (
                      <form action={retryRebate}>
                        <input type="hidden" name="rebate_id" value={r.id} />
                        <Button type="submit" size="sm">
                          Retry
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
