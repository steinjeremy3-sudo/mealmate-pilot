// Admin review queue for Plaid-matched transactions.
//
// Lists every matched_transactions row that needs human attention:
//   - match_confidence in ('medium', 'low'): matcher wasn't confident
//     enough to auto-approve; ops decides.
//   - auto_approval_status='flagged': matcher was 'high' confidence
//     but the 6-check rubric rejected something. Ops inspects.
//
// Sorted riskiest-first (ascending confidence).

import Link from "next/link";

import { Card } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import {
  getPendingReviewMatches,
  type MatchConfidence,
} from "@/lib/db/matched-transactions";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

// The 6-check rubric (src/lib/rubric.ts). flagged_reasons holds the
// FAILED check keys.
const RUBRIC_KEYS = [
  "timing",
  "day",
  "min_spend",
  "mcc",
  "max_per_diner",
  "card_match",
];

const CONFIDENCE: Record<MatchConfidence, { label: string; cls: string; rank: number }> = {
  none: { label: "None", cls: "bg-cream-warm text-muted-foreground", rank: 0 },
  low: { label: "Low", cls: "bg-orange-tint text-orange-deep", rank: 1 },
  medium: { label: "Medium", cls: "bg-amber/15 text-ink/80", rank: 2 },
  high: { label: "High", cls: "bg-cream-warm text-ink", rank: 3 },
};

function initialsOf(name: string | null | undefined): string {
  if (!name) return "·";
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "·"
  );
}

export default async function AdminMatchesPage() {
  await requireRole("admin");
  const rows = (await getPendingReviewMatches()).sort(
    (a, b) =>
      CONFIDENCE[a.matchConfidence].rank - CONFIDENCE[b.matchConfidence].rank,
  );

  return (
    <>
      <PageHeader
        eyebrow="Visits"
        title={
          rows.length === 0 ? (
            "All caught up."
          ) : (
            <>
              {rows.length} waiting for <em>a human.</em>
            </>
          )
        }
        sub="Visits auto-confirm at 90%+ confidence. Everything below — and anything the 6-check rubric flagged — waits here. Riskiest first."
      />

      <div className="px-10 py-8">
        {rows.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            Nothing in the queue. New visits are checked once a day.
          </Card>
        ) : (
          <Card flush className="overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-4 border-b border-border px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              <span className="flex-1">Diner · Restaurant</span>
              <span className="w-24 text-right">Amount</span>
              <span className="w-28">Txn date</span>
              <span className="w-20">Confidence</span>
              <span className="w-28">Rubric</span>
            </div>
            {rows.map((row) => {
              const conf = CONFIDENCE[row.matchConfidence];
              const failed = new Set(row.flaggedReasons ?? []);
              const passCount = RUBRIC_KEYS.filter((k) => !failed.has(k)).length;
              return (
                <Link
                  key={row.id}
                  href={`/admin/matches/${row.id}`}
                  className="flex items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-cream-warm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cream-warm font-mono text-[11px]">
                      {initialsOf(row.claim?.diner?.displayName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base">
                        {row.restaurant?.name ?? row.merchantNameRaw}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.claim?.diner?.displayName ?? "no linked offer"}
                        {row.autoApprovalStatus === "flagged" ? (
                          <span className="text-destructive"> · flagged</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <span className="w-24 text-right font-mono text-sm">
                    {centsToUsd(row.amountCents)}
                  </span>
                  <span className="w-28 font-mono text-xs text-muted-foreground">
                    {row.transactionDate}
                  </span>
                  <span className="w-20">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]",
                        conf.cls,
                      )}
                    >
                      {conf.label}
                    </span>
                  </span>
                  <span className="flex w-28 items-center gap-1.5">
                    <span className="flex gap-1">
                      {RUBRIC_KEYS.map((k) => (
                        <span
                          key={k}
                          className={cn(
                            "size-2.5 rounded-[2px]",
                            failed.has(k) ? "bg-orange-deep" : "bg-ink",
                          )}
                        />
                      ))}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {passCount}/6
                    </span>
                  </span>
                </Link>
              );
            })}
          </Card>
        )}
      </div>
    </>
  );
}
