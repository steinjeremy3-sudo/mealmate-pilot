// Admin rebate visibility.
//
// Phase 4d.1: pure read-only list. Every approved match creates a
// rebates row in 'initiated' state; this page is where ops sees them.
// No issuance button yet — Phase 4d.2 adds the Dwolla "send now" flow.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getAllRebates } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";

export default async function AdminRebatesPage() {
  await requireRole("admin");
  const rebates = await getAllRebates();

  const counts = rebates.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Rebates · Dwolla
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {rebates.length === 0 ? "No rebates yet" : `${rebates.length} total`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {counts.initiated ? `${counts.initiated} initiated · ` : ""}
            {counts.sent ? `${counts.sent} sent · ` : ""}
            {counts.settled ? `${counts.settled} settled · ` : ""}
            {counts.failed ? `${counts.failed} failed` : ""}
            {Object.keys(counts).length === 0 ? "—" : ""}
          </p>
        </div>

        {rebates.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            No rebates created yet. They&apos;ll show up once approved
            matches start landing.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {rebates.map((r) => (
              <li key={r.id} className="p-4">
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
                    <p className="text-xs text-muted-foreground">
                      <Badge status={r.status} />
                      {" · "}provider {r.provider}
                      {r.providerTransferId ? (
                        <> · transfer {r.providerTransferId.slice(0, 12)}…</>
                      ) : null}
                    </p>
                    {r.errorMessage ? (
                      <p className="text-xs text-destructive">
                        {r.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="font-medium">{centsToUsd(r.amountCents)}</p>
                    <p className="text-xs text-muted-foreground">
                      created {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    <Link
                      href={`/admin/matches/${r.matchedTransactionId}`}
                      className="text-xs underline underline-offset-4 text-muted-foreground"
                    >
                      match details →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground border-t pt-3">
          Phase 4d.1: rebate rows are created in &apos;initiated&apos;
          state and don&apos;t move automatically yet. Phase 4d.2 adds
          the Dwolla transfer call + webhook to advance them through
          sent → settled / failed.
        </p>
      </div>
    </main>
  );
}

function Badge({ status }: { status: string }) {
  const color =
    status === "settled"
      ? "text-emerald-700"
      : status === "sent"
      ? "text-blue-700"
      : status === "failed"
      ? "text-destructive"
      : "text-zinc-600";
  return <span className={`font-mono uppercase ${color}`}>{status}</span>;
}
