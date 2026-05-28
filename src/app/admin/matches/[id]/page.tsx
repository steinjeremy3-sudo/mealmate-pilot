// Per-row admin review page. Shows the matched transaction, the
// matcher's restaurant guess, the diner's claim (if any), and a
// rebate preview computed from current offer terms. Ops can approve
// (→ manual_approved + money snapshot + claim 'matched') or reject.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";

import { Button, Card, Eyebrow, PlaceholderImg } from "@/components/brand";
import { KpiCard } from "@/components/console/KpiCard";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import {
  getMatchScoreBreakdown,
  getReviewMatchDetail,
} from "@/lib/db/matched-transactions";
import { centsToUsd } from "@/lib/money";
import { computeRebate } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { approveMatch, rejectMatch } from "./actions";
import { REJECT_REASONS } from "./reject-reasons";

// The 6-check auto-approval rubric (src/lib/rubric.ts). flagged_reasons
// stores the FAILED checks; we render all six with a pass/fail mark.
const RUBRIC_CHECKS: { key: string; label: string }[] = [
  { key: "timing", label: "Within offer hours" },
  { key: "day", label: "Valid day" },
  { key: "min_spend", label: "Meets minimum check" },
  { key: "mcc", label: "Eligible merchant category" },
  { key: "max_per_diner", label: "Within per-diner cap" },
  { key: "card_match", label: "Card belongs to diner" },
];

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default async function AdminMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const row = await getReviewMatchDetail(id);
  if (!row) notFound();

  const scoreBreakdown = await getMatchScoreBreakdown(id);

  const previewBreakdown =
    row.claim?.offer && row.claim.offer.discountPct
      ? computeRebate(row.amountCents, row.claim.offer.discountPct)
      : null;

  const flagged = new Set(row.flaggedReasons ?? []);
  const isFlagged = row.autoApprovalStatus === "flagged";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/admin/matches"
            className="transition-colors hover:text-paprika"
          >
            ← Visit queue
          </Link>
        }
        title={row.restaurant?.name ?? row.merchantNameRaw}
        sub={
          <>
            {centsToUsd(row.amountCents)} · {row.transactionDate} · confidence{" "}
            <span className="font-mono uppercase">{row.matchConfidence}</span>
            {isFlagged ? (
              <> · flagged: {row.flaggedReasons?.join(", ")}</>
            ) : null}
          </>
        }
      />

      <div className="px-10 py-8">
        <div className="w-full max-w-3xl space-y-6">
          <PlaceholderImg
            name={row.restaurant?.name ?? row.merchantNameRaw}
            className="h-40 rounded-2xl"
          />
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Check amount" value={centsToUsd(row.amountCents)} />
            <KpiCard
              label="Discount"
              value={
                previewBreakdown
                  ? centsToUsd(previewBreakdown.discountCents)
                  : "—"
              }
            />
            <KpiCard
              label="Diner cash back"
              value={
                previewBreakdown
                  ? centsToUsd(previewBreakdown.rebateCents)
                  : "—"
              }
              hint={previewBreakdown ? "discount − platform fee" : undefined}
            />
            <KpiCard
              label="Confidence"
              value={
                row.matchConfidence.charAt(0).toUpperCase() +
                row.matchConfidence.slice(1)
              }
              hint={
                scoreBreakdown
                  ? `${pct(scoreBreakdown.combinedScore)} combined`
                  : undefined
              }
            />
          </div>

          {/* 6-check rubric — only meaningful for a flagged match */}
          {isFlagged ? (
            <Card className="space-y-3 p-6">
              <div>
                <h2 className="font-display text-xl tracking-tight">
                  Six-check rubric
                </h2>
                <p className="text-xs text-muted-foreground">
                  A high-confidence visit the rubric still flagged.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {RUBRIC_CHECKS.map((check) => {
                  const failed = flagged.has(check.key);
                  return (
                    <div
                      key={check.key}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3.5",
                        failed
                          ? "border-paprika/30 bg-paprika-tint"
                          : "border-ink/15 bg-bone-deep",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-bone",
                          failed ? "bg-paprika-deep" : "bg-ink",
                        )}
                      >
                        {failed ? (
                          <X className="size-3.5" strokeWidth={3} />
                        ) : (
                          <Check className="size-3.5" strokeWidth={3} />
                        )}
                      </span>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          {check.label}
                        </p>
                        <p className="mt-0.5 text-[13px] font-medium">
                          {failed ? "Failed" : "Passed"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {/* Restaurant guess + claim */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="space-y-1 p-6">
              <Eyebrow tone="muted">Restaurant guess</Eyebrow>
              <p className="font-medium">
                {row.restaurant ? row.restaurant.name : "(none)"}
                {row.restaurantCity ? ` · ${row.restaurantCity}` : null}
              </p>
              {row.merchantNameNormalized ? (
                <p className="text-xs text-muted-foreground">
                  normalized:{" "}
                  <code className="font-mono text-foreground">
                    {row.merchantNameNormalized}
                  </code>
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                raw:{" "}
                <code className="font-mono text-foreground">
                  {row.merchantNameRaw}
                </code>
              </p>
            </Card>

            <Card className="space-y-1 p-6">
              <Eyebrow tone="muted">Diner offer</Eyebrow>
              {row.claim ? (
                <>
                  <p className="font-medium">
                    {row.claim.diner?.displayName ?? "Unknown diner"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.claim.diner?.email ?? "no email"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    offer: {row.claim.offer?.title ?? "(missing)"} ·{" "}
                    {row.claim.offer?.discountPct ?? 0}% off
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No offer attached. Approving without one doesn&apos;t
                  make sense — reject this row, or attach an offer manually
                  via psql for now.
                </p>
              )}
            </Card>
          </div>

          {/* Confidence score breakdown */}
          {scoreBreakdown ? (
            <Card className="space-y-2 p-6">
              <Eyebrow tone="muted">
                Visit confidence · {pct(scoreBreakdown.combinedScore)} combined
              </Eyebrow>
              <ul className="space-y-1 text-sm">
                {(
                  [
                    ["Merchant name", scoreBreakdown.dimensions.name],
                    ["Timing", scoreBreakdown.dimensions.timing],
                    ["Amount", scoreBreakdown.dimensions.amount],
                    ["Geography", scoreBreakdown.dimensions.geography],
                  ] as const
                ).map(([label, score]) => (
                  <li key={label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono">{pct(score)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Rebate preview */}
          {previewBreakdown ? (
            <Card className="space-y-1 p-6">
              <Eyebrow tone="muted">Cash-back preview</Eyebrow>
              <ul className="space-y-0.5 text-sm">
                <li>Check total: {centsToUsd(row.amountCents)}</li>
                <li>
                  Discount ({row.claim?.offer?.discountPct}%):{" "}
                  {centsToUsd(previewBreakdown.discountCents)}
                </li>
                <li>
                  Platform fee: {centsToUsd(previewBreakdown.platformFeeCents)}
                </li>
                <li className="font-medium text-paprika-deep">
                  Cash back to diner: {centsToUsd(previewBreakdown.rebateCents)}
                </li>
              </ul>
            </Card>
          ) : null}

          {/* Actions */}
          <Card className="space-y-4 p-6">
            <form action={approveMatch}>
              <input type="hidden" name="match_id" value={row.id} />
              <Button type="submit" disabled={!row.claim}>
                Approve &amp; queue cash back
              </Button>
              {!row.claim ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No offer attached — nothing to approve against.
                </p>
              ) : null}
            </form>

            <form
              action={rejectMatch}
              className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
            >
              <input type="hidden" name="match_id" value={row.id} />
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Reject reason</span>
                <select
                  name="reason"
                  defaultValue="wrong_restaurant"
                  className="block rounded-lg border border-border bg-bone px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika"
                >
                  {Object.entries(REJECT_REASONS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="ghost">
                Reject
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Rejecting cancels the cash back and notifies the diner. The
              merchant is not invoiced for this visit.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
