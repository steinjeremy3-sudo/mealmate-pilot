// Admin review queue for Plaid-matched transactions.
//
// Lists every matched_transactions row that needs human attention:
//   - match_confidence in ('medium', 'low'): matcher wasn't confident
//     enough to auto-approve; ops decides.
//   - auto_approval_status='flagged': matcher was 'high' confidence
//     but the 6-check rubric rejected something. Ops inspects.
//
// Already-reviewed rows (reviewed_at IS NOT NULL) drop out of the list.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getPendingReviewMatches } from "@/lib/db/matched-transactions";
import { centsToUsd } from "@/lib/money";

export default async function AdminMatchesPage() {
  await requireRole("admin");
  const rows = await getPendingReviewMatches();

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Plaid matches · review queue
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {rows.length === 0 ? "All caught up" : `${rows.length} pending`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Medium- and low-confidence matches, plus high-confidence
            matches that the rubric flagged. Decide each one.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            Nothing in the queue. Cron runs every 30 min.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/matches/${row.id}`}
                  className="block p-4 hover:bg-secondary/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium">{row.merchantNameRaw}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.restaurant ? (
                          <>guess: {row.restaurant.name} · </>
                        ) : (
                          <>no restaurant guess · </>
                        )}
                        {row.claim?.diner?.displayName ?? "no diner claim"}
                        {row.claim?.offer ? (
                          <> · {row.claim.offer.title}</>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Badge confidence={row.matchConfidence} />
                        {row.autoApprovalStatus === "flagged" ? (
                          <>
                            {" "}
                            · <span className="text-amber-700">flagged</span>
                            {row.flaggedReasons?.length ? (
                              <>: {row.flaggedReasons.join(", ")}</>
                            ) : null}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium">
                        {centsToUsd(row.amountCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.transactionDate}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function Badge({ confidence }: { confidence: string }) {
  const color =
    confidence === "high"
      ? "text-emerald-700"
      : confidence === "medium"
      ? "text-blue-700"
      : confidence === "low"
      ? "text-zinc-600"
      : "text-zinc-400";
  return <span className={`font-mono uppercase ${color}`}>{confidence}</span>;
}
