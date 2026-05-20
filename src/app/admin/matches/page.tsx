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
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getPendingReviewMatches } from "@/lib/db/matched-transactions";
import { centsToUsd } from "@/lib/money";

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const tone =
    confidence === "high"
      ? "border-sage/40 bg-sage-tint text-sage"
      : confidence === "medium"
        ? "border-orange/30 bg-orange-tint text-orange-deep"
        : "border-border bg-cream-warm text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}
    >
      {confidence}
    </span>
  );
}

export default async function AdminMatchesPage() {
  await requireRole("admin");
  const rows = await getPendingReviewMatches();

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Plaid matches · review queue</Eyebrow>
          <Heading as="h1" size="page">
            {rows.length === 0 ? (
              "All caught up"
            ) : (
              <>
                <em>{rows.length}</em> pending
              </>
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            Medium- and low-confidence matches, plus high-confidence
            matches that the rubric flagged. Decide each one.
          </p>
        </div>

        {rows.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            Nothing in the queue. The matcher runs on the daily cron.
          </Card>
        ) : (
          <Card flush className="divide-y divide-border overflow-hidden">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/admin/matches/${row.id}`}
                className="block p-4 transition-colors hover:bg-cream-warm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
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
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ConfidenceBadge confidence={row.matchConfidence} />
                      {row.autoApprovalStatus === "flagged" ? (
                        <span className="text-destructive">
                          flagged
                          {row.flaggedReasons?.length
                            ? `: ${row.flaggedReasons.join(", ")}`
                            : ""}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">
                      {centsToUsd(row.amountCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.transactionDate}
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
