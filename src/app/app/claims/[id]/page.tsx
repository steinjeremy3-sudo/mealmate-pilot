// Diner claim detail / receipt.
//
// Adapts to the claim's state:
//   - claimed + not expired  -> active card with Pay + Cancel actions
//   - claimed + past expiry  -> "expired" + offer info
//   - consumed (paid)        -> full receipt with subtotal/discount/fee/total
//                                + payout batch reference if ACH'd
//   - cancelled              -> "cancelled" + offer info
//
// Reached from /app/claims (list) or directly via deep link.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import {
  expiresInMinutes,
  getClaimByIdForDiner,
  isClaimActive,
} from "@/lib/db/claims";
import { getPaymentForClaim } from "@/lib/db/payments";
import { centsToUsd } from "@/lib/money";

import { cancelClaim } from "../actions";

type Params = Promise<{ id: string }>;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DinerClaimDetail({
  params,
}: {
  params: Params;
}) {
  await requireRole("diner");
  const { id } = await params;

  const [claim, payment] = await Promise.all([
    getClaimByIdForDiner(id),
    getPaymentForClaim(id),
  ]);
  if (!claim || !claim.offer) notFound();

  const isActive = isClaimActive(claim);
  const isPaid = claim.status === "consumed" && payment != null;
  const isCancelled = claim.status === "cancelled";
  const isExpired = !isActive && !isPaid && !isCancelled;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-5">
        <Link
          href="/app/claims"
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          ← Back to claims
        </Link>

        {/* ===== Offer info ===== */}
        <div className="space-y-2">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            {claim.offer.restaurant?.name ?? "Restaurant"}
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {claim.offer.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Claimed {formatDateTime(claim.claimed_at)}
          </p>
        </div>

        {/* ===== State-specific block ===== */}
        {isActive ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3 text-center">
            <p className="font-medium text-emerald-900">
              Claim active — expires in {expiresInMinutes(claim)} min
            </p>
            <p className="text-xs text-emerald-700">
              Show this at {claim.offer.restaurant?.name ?? "the restaurant"} to
              redeem.
            </p>
            <div className="flex gap-2 pt-2 border-t border-emerald-200">
              <Link
                href={`/app/claims/${claim.id}/pay`}
                className="flex-1 rounded-md bg-emerald-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-emerald-800"
              >
                Pay
              </Link>
              <form action={cancelClaim}>
                <input type="hidden" name="claim_id" value={claim.id} />
                <button
                  type="submit"
                  className="cursor-pointer rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {isPaid && payment ? (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Receipt
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{centsToUsd(payment.subtotal_cents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Discount ({claim.offer.discount_pct}%)
                </dt>
                <dd>− {centsToUsd(payment.discount_cents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Platform fee</dt>
                <dd>+ {centsToUsd(payment.platform_fee_cents)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <dt>You paid</dt>
                <dd>{centsToUsd(payment.total_cents)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground border-t pt-2">
              Paid {formatDateTime(payment.created_at)} ·{" "}
              <span className="font-mono break-all">
                {payment.stripe_payment_intent_id}
              </span>
            </p>
            {payment.paid_out_at ? (
              <p className="text-xs text-emerald-700 border-t pt-2">
                Restaurant paid out {formatDateTime(payment.paid_out_at)}
                {payment.payout_batch_id ? ` · ${payment.payout_batch_id}` : ""}.
              </p>
            ) : null}
          </div>
        ) : null}

        {isExpired ? (
          <div className="rounded-md border border-border p-4 text-center text-sm">
            <p className="font-medium">Claim expired</p>
            <p className="text-xs text-muted-foreground pt-1">
              You didn&apos;t pay within the 1-hour window. If the offer is
              still live, you can claim it again.
            </p>
            <Link
              href={`/app/offers/${claim.offer.id}`}
              className="text-xs underline underline-offset-4 inline-block pt-2"
            >
              See offer
            </Link>
          </div>
        ) : null}

        {isCancelled ? (
          <div className="rounded-md border border-border p-4 text-center text-sm">
            <p className="font-medium">Claim cancelled</p>
            <p className="text-xs text-muted-foreground pt-1">
              You cancelled this before paying. Re-claim from the offer page
              if it&apos;s still live.
            </p>
            <Link
              href={`/app/offers/${claim.offer.id}`}
              className="text-xs underline underline-offset-4 inline-block pt-2"
            >
              See offer
            </Link>
          </div>
        ) : null}

        {/* ===== Offer details (always show, below state block) ===== */}
        <div className="rounded-md border border-border p-4 space-y-2 text-sm">
          {claim.offer.description ? (
            <p className="text-sm">{claim.offer.description}</p>
          ) : null}
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
            <p>
              {claim.offer.restaurant?.address ?? "—"}
              {claim.offer.restaurant?.neighborhood
                ? ` · ${claim.offer.restaurant.neighborhood}`
                : ""}
            </p>
            <p>{claim.offer.discount_pct}% off</p>
          </div>
        </div>
      </div>
    </main>
  );
}
