// Diner claim detail.
//
// Adapts to the claim's state:
//   - claimed + not expired      → active card with Cancel action
//   - matched / consumed         → "redeemed; rebate processing"
//                                   (full rebate detail lands in Phase 4d
//                                   once matched_transactions data flows)
//   - claimed + past expiry      → "expired"
//   - cancelled                  → "cancelled"
//
// In the rebate model the diner pays at the POS — there is no in-app
// pay step here.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import {
  expiresInMinutes,
  getClaimByIdForDiner,
  isClaimActive,
} from "@/lib/db/claims";

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

  const claim = await getClaimByIdForDiner(id);
  if (!claim || !claim.offer) notFound();

  const isActive = isClaimActive(claim);
  const isRedeemed = claim.status === "matched" || claim.status === "consumed";
  const isCancelled = claim.status === "cancelled";
  const isExpired = !isActive && !isRedeemed && !isCancelled;

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
              Eat at {claim.offer.restaurant?.name ?? "the restaurant"} and
              pay with your linked card. We&apos;ll match the transaction
              and rebate you within 1–2 business days.
            </p>
            <form action={cancelClaim} className="pt-2 border-t border-emerald-200">
              <input type="hidden" name="claim_id" value={claim.id} />
              <button
                type="submit"
                className="cursor-pointer rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
              >
                Cancel this claim
              </button>
            </form>
          </div>
        ) : null}

        {isRedeemed ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 p-4 space-y-2">
            <p className="font-medium text-sky-900">Rebate on its way</p>
            <p className="text-xs text-sky-800">
              We matched your visit to this offer. The cash-back rebate
              posts to your linked card within 1–2 business days.
            </p>
            {/* Phase 4d: render rebate breakdown (discount, fee, net) +
                Visa Direct status from matched_transactions + rebates. */}
          </div>
        ) : null}

        {isExpired ? (
          <div className="rounded-md border border-border p-4 text-center text-sm">
            <p className="font-medium">Claim expired</p>
            <p className="text-xs text-muted-foreground pt-1">
              The transaction didn&apos;t come through in time. Re-claim
              from the offer page if it&apos;s still live.
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
              You cancelled this claim. Re-claim from the offer page if
              it&apos;s still live.
            </p>
            <Link
              href={`/app/offers/${claim.offer.id}`}
              className="text-xs underline underline-offset-4 inline-block pt-2"
            >
              See offer
            </Link>
          </div>
        ) : null}

        {/* ===== Offer details (always show) ===== */}
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
