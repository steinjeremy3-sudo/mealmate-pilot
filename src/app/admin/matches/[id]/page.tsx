// Per-row admin review page. Shows the matched transaction, the
// matcher's restaurant guess, the diner's claim (if any), and a
// rebate preview computed from current offer terms. Ops can approve
// (→ manual_approved + money snapshot + claim 'matched') or reject.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import {
  getMatchScoreBreakdown,
  getReviewMatchDetail,
} from "@/lib/db/matched-transactions";
import { centsToUsd } from "@/lib/money";
import { computeRebate } from "@/lib/pricing";

import { approveMatch, rejectMatch } from "./actions";
import { REJECT_REASONS } from "./reject-reasons";

// The 6-check auto-approval rubric (src/lib/rubric.ts). flagged_reasons
// stores the FAILED checks; we render all six with a pass/fail mark.
const RUBRIC_CHECKS: { key: string; label: string }[] = [
  { key: "timing", label: "Within offer hours" },
  { key: "day", label: "Valid day" },
  { key: "min_spend", label: "Meets minimum check" },
  { key: "mcc", label: "Eligible merchant category" },
  { key: "max_per_diner", label: "Within per-diner claim cap" },
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

  const [scoreBreakdown] = await Promise.all([getMatchScoreBreakdown(id)]);

  const previewBreakdown =
    row.claim?.offer && row.claim.offer.discountPct
      ? computeRebate(row.amountCents, row.claim.offer.discountPct)
      : null;

  const flagged = new Set(row.flaggedReasons ?? []);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/admin/matches"
          className="text-sm text-muted-foreground transition-colors hover:text-orange"
        >
          ← Back to queue
        </Link>

        <div className="space-y-1">
          <Eyebrow>Match review</Eyebrow>
          <Heading as="h1" size="page">
            {row.merchantNameRaw}
          </Heading>
          <p className="text-sm text-muted-foreground">
            {centsToUsd(row.amountCents)} · {row.transactionDate} ·
            confidence{" "}
            <span className="font-mono uppercase">{row.matchConfidence}</span>
            {row.autoApprovalStatus === "flagged" ? (
              <> · flagged: {row.flaggedReasons?.join(", ")}</>
            ) : null}
          </p>
        </div>

        {/* Restaurant guess */}
        <Card className="space-y-1">
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
        </Card>

        {/* Claim */}
        <Card className="space-y-1">
          <Eyebrow tone="muted">Diner claim</Eyebrow>
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
              No claim attached. Approving without a claim doesn&apos;t
              make sense — reject this row, or attach a claim manually
              via psql for now.
            </p>
          )}
        </Card>

        {/* Confidence score breakdown */}
        {scoreBreakdown ? (
          <Card className="space-y-2">
            <Eyebrow tone="muted">
              Match confidence · {pct(scoreBreakdown.combinedScore)} combined
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

        {/* 6-check rubric — only meaningful for a flagged match */}
        {row.autoApprovalStatus === "flagged" ? (
          <Card className="space-y-2">
            <Eyebrow tone="muted">Auto-approval rubric</Eyebrow>
            <ul className="space-y-1 text-sm">
              {RUBRIC_CHECKS.map((check) => {
                const failed = flagged.has(check.key);
                return (
                  <li
                    key={check.key}
                    className="flex justify-between gap-4"
                  >
                    <span className="text-muted-foreground">
                      {check.label}
                    </span>
                    <span
                      className={
                        failed
                          ? "font-mono text-destructive"
                          : "font-mono text-sage"
                      }
                    >
                      {failed ? "FAIL" : "pass"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {/* Rebate preview */}
        {previewBreakdown ? (
          <Card className="space-y-1">
            <Eyebrow tone="muted">Rebate preview</Eyebrow>
            <ul className="space-y-0.5 text-sm">
              <li>Check total: {centsToUsd(row.amountCents)}</li>
              <li>
                Discount ({row.claim?.offer?.discountPct}%):{" "}
                {centsToUsd(previewBreakdown.discountCents)}
              </li>
              <li>
                Platform fee: {centsToUsd(previewBreakdown.platformFeeCents)}
              </li>
              <li className="font-medium text-orange-deep">
                Rebate to diner: {centsToUsd(previewBreakdown.rebateCents)}
              </li>
            </ul>
          </Card>
        ) : null}

        {/* Actions */}
        <Card className="space-y-4">
          <form action={approveMatch}>
            <input type="hidden" name="match_id" value={row.id} />
            <Button type="submit" disabled={!row.claim}>
              Approve match
            </Button>
            {!row.claim ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No claim attached — nothing to approve against.
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
                className="block rounded-lg border border-border bg-cream-soft px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
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
        </Card>
      </div>
    </div>
  );
}
