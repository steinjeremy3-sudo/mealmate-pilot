// Per-row admin review page. Shows the matched transaction, the
// matcher's restaurant guess, the diner's claim (if any), and a
// rebate preview computed from current offer terms. Ops can approve
// (→ manual_approved + money snapshot + claim 'matched') or reject.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
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
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <Link
          href="/admin/matches"
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          ← back to queue
        </Link>

        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Match review
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {row.merchantNameRaw}
          </h1>
          <p className="text-sm text-muted-foreground">
            {centsToUsd(row.amountCents)} · {row.transactionDate} ·{" "}
            confidence{" "}
            <span className="font-mono uppercase">{row.matchConfidence}</span>
            {row.autoApprovalStatus === "flagged" ? (
              <> · flagged: {row.flaggedReasons?.join(", ")}</>
            ) : null}
          </p>
        </div>

        {/* Restaurant guess */}
        <section className="rounded-md border border-border p-4 space-y-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Restaurant guess
          </p>
          <p className="font-medium">
            {row.restaurant ? row.restaurant.name : "(none)"}
            {row.restaurantCity ? ` · ${row.restaurantCity}` : null}
          </p>
          {row.merchantNameNormalized ? (
            <p className="text-xs text-muted-foreground">
              normalized:{" "}
              <code className="font-mono">{row.merchantNameNormalized}</code>
            </p>
          ) : null}
        </section>

        {/* Claim */}
        <section className="rounded-md border border-border p-4 space-y-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Diner claim
          </p>
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
              No claim attached. Approving without a claim doesn&apos;t make
              sense — reject this row, or attach a claim manually via
              psql for now (admin-edit UI is Phase 4c+).
            </p>
          )}
        </section>

        {/* Rebate preview */}
        {previewBreakdown ? (
          <section className="rounded-md border border-border p-4 space-y-1">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Rebate preview
            </p>
            <ul className="text-sm space-y-0.5">
              <li>Check total: {centsToUsd(row.amountCents)}</li>
              <li>
                Discount ({row.claim?.offer?.discountPct}%):{" "}
                {centsToUsd(previewBreakdown.discountCents)}
              </li>
              <li>
                Platform fee:{" "}
                {centsToUsd(previewBreakdown.platformFeeCents)}
              </li>
              <li className="font-medium">
                Rebate to diner:{" "}
                {centsToUsd(previewBreakdown.rebateCents)}
              </li>
            </ul>
          </section>
        ) : null}

        {/* Actions */}
        <section className="flex items-center gap-3">
          <form action={approveMatch}>
            <input type="hidden" name="match_id" value={row.id} />
            <button
              type="submit"
              disabled={!row.claim}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Approve
            </button>
          </form>
          <form action={rejectMatch}>
            <input type="hidden" name="match_id" value={row.id} />
            <button
              type="submit"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/40"
            >
              Reject
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
