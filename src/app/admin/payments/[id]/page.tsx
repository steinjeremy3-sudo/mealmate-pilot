// Admin: review one payment. Phase 2e supports Approve (manual_approved)
// and Reject (rejected) for flagged payments. Already-reviewed payments
// show their reviewed_at timestamp instead of action buttons.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getPaymentByIdWithRelations, type AutoApprovalStatus } from "@/lib/db/payments";
import { centsToUsd } from "@/lib/money";

import { approvePayment, rejectPayment } from "./actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

const RUBRIC_LABEL: Record<string, string> = {
  timing: "Claim was outside the offer's valid hours",
  day: "Claim was on a non-valid day of week",
  min_spend: "Subtotal was below the offer minimum",
  mcc: "Restaurant MCC didn't match the offer category",
  max_per_diner: "Diner exceeded the per-offer claim cap",
  card_match: "Card at payment didn't match the diner",
};

function StatusBadge({ status }: { status: AutoApprovalStatus }) {
  const styles: Record<AutoApprovalStatus, string> = {
    auto_approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
    flagged: "bg-yellow-100 text-yellow-900 border-yellow-200",
    rejected: "bg-red-100 text-red-900 border-red-200",
    manual_approved: "bg-sky-100 text-sky-900 border-sky-200",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        styles[status]
      }
    >
      {status.replace("_", " ")}
    </span>
  );
}

export default async function AdminPaymentReview({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole("admin");

  const { id } = await params;
  const { error } = await searchParams;
  const payment = await getPaymentByIdWithRelations(id);
  if (!payment) notFound();

  const isFlagged = payment.auto_approval_status === "flagged";
  const reasons = payment.flagged_reasons ?? [];

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <Link href="/admin" className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back to queue
        </Link>

        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                Payment review
              </p>
              <h1 className="font-serif text-3xl font-semibold">
                {centsToUsd(payment.total_cents)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {payment.claim?.offer?.restaurant?.name ?? "—"} ·{" "}
                {payment.claim?.offer?.title ?? "—"}
              </p>
            </div>
            <StatusBadge status={payment.auto_approval_status} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-2 border-t">
            <dt className="text-muted-foreground">Diner</dt>
            <dd>{payment.claim?.diner?.display_name ?? "—"}</dd>

            <dt className="text-muted-foreground">Diner email</dt>
            <dd className="break-all">{payment.claim?.diner?.email ?? "—"}</dd>

            <dt className="text-muted-foreground">Claimed at</dt>
            <dd>
              {payment.claim?.claimed_at
                ? new Date(payment.claim.claimed_at).toLocaleString()
                : "—"}
            </dd>

            <dt className="text-muted-foreground">Paid at</dt>
            <dd>{new Date(payment.created_at).toLocaleString()}</dd>

            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{centsToUsd(payment.subtotal_cents)}</dd>

            <dt className="text-muted-foreground">Discount</dt>
            <dd>
              − {centsToUsd(payment.discount_cents)}
              {payment.claim?.offer
                ? ` (${payment.claim.offer.discount_pct}%)`
                : ""}
            </dd>

            <dt className="text-muted-foreground">Platform fee</dt>
            <dd>+ {centsToUsd(payment.platform_fee_cents)}</dd>

            <dt className="text-muted-foreground">Diner paid</dt>
            <dd className="font-medium">{centsToUsd(payment.total_cents)}</dd>

            <dt className="text-muted-foreground">Restaurant payout</dt>
            <dd>{centsToUsd(payment.payout_cents)}</dd>

            <dt className="text-muted-foreground">Stripe PI</dt>
            <dd className="font-mono text-xs break-all">
              {payment.stripe_payment_intent_id}
            </dd>
          </dl>

          {reasons.length > 0 ? (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 space-y-2">
              <p className="text-sm font-medium text-yellow-900">
                Failed rubric checks
              </p>
              <ul className="text-sm text-yellow-900 list-disc pl-5 space-y-1">
                {reasons.map((r) => (
                  <li key={r}>{RUBRIC_LABEL[r] ?? r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {isFlagged ? (
            <div className="flex gap-3 pt-2 border-t">
              <form action={approvePayment}>
                <input type="hidden" name="payment_id" value={payment.id} />
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Approve anyway
                </button>
              </form>
              <form action={rejectPayment}>
                <input type="hidden" name="payment_id" value={payment.id} />
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </form>
            </div>
          ) : payment.reviewed_at ? (
            <p className="text-sm text-muted-foreground pt-2 border-t">
              Reviewed {new Date(payment.reviewed_at).toLocaleString()}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground pt-2 border-t">
              Auto-approved. No review needed.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
