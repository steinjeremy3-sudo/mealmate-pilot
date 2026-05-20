// Diner claim detail. Adapts to the claim's state:
//   - claimed + not expired → active panel with Cancel action
//   - matched / consumed    → "redeemed; rebate processing"
//   - claimed + past expiry → "expired"
//   - cancelled             → "cancelled"
//
// In the rebate model the diner pays at the POS — no in-app pay step.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
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
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/app/claims"
          className="text-sm text-muted-foreground transition-colors hover:text-orange"
        >
          ← Back to claims
        </Link>

        {/* ===== Offer info ===== */}
        <div className="space-y-2">
          <Eyebrow>{claim.offer.restaurant?.name ?? "Restaurant"}</Eyebrow>
          <Heading as="h1" size="page">
            {claim.offer.title}
          </Heading>
          <p className="text-xs text-muted-foreground">
            Claimed {formatDateTime(claim.claimed_at)}
          </p>
        </div>

        {/* ===== State-specific panel ===== */}
        {isActive ? (
          <Card className="space-y-3 border-sage/40 bg-sage-tint text-center">
            <p className="font-medium text-ink">
              Claim active — expires in {expiresInMinutes(claim)} min
            </p>
            <p className="text-xs text-ink/70">
              Eat at {claim.offer.restaurant?.name ?? "the restaurant"} and
              pay with your linked card. We&apos;ll match the transaction
              and rebate you within 1–2 business days.
            </p>
            <form
              action={cancelClaim}
              className="border-t border-sage/30 pt-3"
            >
              <input type="hidden" name="claim_id" value={claim.id} />
              <button
                type="submit"
                className="cursor-pointer rounded-full border border-sage/40 bg-cream-soft px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream-warm"
              >
                Cancel this claim
              </button>
            </form>
          </Card>
        ) : null}

        {isRedeemed ? (
          <Card className="space-y-2 border-orange/30 bg-orange-tint">
            <p className="font-medium text-ink">Rebate on its way</p>
            <p className="text-xs text-ink/70">
              We matched your visit to this offer. The cash-back rebate
              posts to your linked account within 1–2 business days.
            </p>
          </Card>
        ) : null}

        {isExpired ? (
          <Card className="space-y-1 text-center text-sm">
            <p className="font-medium">Claim expired</p>
            <p className="text-xs text-muted-foreground">
              The transaction didn&apos;t come through in time. Re-claim
              from the offer page if it&apos;s still live.
            </p>
            <Link
              href={`/app/offers/${claim.offer.id}`}
              className="inline-block pt-1 text-xs text-orange underline underline-offset-4"
            >
              See offer
            </Link>
          </Card>
        ) : null}

        {isCancelled ? (
          <Card className="space-y-1 text-center text-sm">
            <p className="font-medium">Claim cancelled</p>
            <p className="text-xs text-muted-foreground">
              You cancelled this claim. Re-claim from the offer page if
              it&apos;s still live.
            </p>
            <Link
              href={`/app/offers/${claim.offer.id}`}
              className="inline-block pt-1 text-xs text-orange underline underline-offset-4"
            >
              See offer
            </Link>
          </Card>
        ) : null}

        {/* ===== Offer details (always shown) ===== */}
        <Card className="space-y-2 text-sm">
          {claim.offer.description ? (
            <p>{claim.offer.description}</p>
          ) : null}
          <div className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
            <p>
              {claim.offer.restaurant?.address ?? "—"}
              {claim.offer.restaurant?.neighborhood
                ? ` · ${claim.offer.restaurant.neighborhood}`
                : ""}
            </p>
            <p>{claim.offer.discount_pct}% off</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
