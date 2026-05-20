// Per-row admin review page. Shows the matched transaction, the
// matcher's restaurant guess, the diner's claim (if any), and a
// rebate preview computed from current offer terms. Ops can approve
// (→ manual_approved + money snapshot + claim 'matched') or reject.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import { getReviewMatchDetail } from "@/lib/db/matched-transactions";
import { centsToUsd } from "@/lib/money";
import { computeRebate } from "@/lib/pricing";

import { approveMatch, rejectMatch } from "./actions";

export default async function AdminMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const row = await getReviewMatchDetail(id);
  if (!row) notFound();

  const previewBreakdown =
    row.claim?.offer && row.claim.offer.discountPct
      ? computeRebate(row.amountCents, row.claim.offer.discountPct)
      : null;

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
        <div className="flex items-center gap-3">
          <form action={approveMatch}>
            <input type="hidden" name="match_id" value={row.id} />
            <Button type="submit" disabled={!row.claim}>
              Approve
            </Button>
          </form>
          <form action={rejectMatch}>
            <input type="hidden" name="match_id" value={row.id} />
            <Button type="submit" variant="ghost">
              Reject
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
