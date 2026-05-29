// Claim confirmation step.
//
// Two states:
//   - no active claim → review the terms, confirm to place the claim
//   - active claim    → conflict screen (one claim per offer)
// The actual insert + caps live in claimOffer (../actions).

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import { getActiveClaimForOffer } from "@/lib/db/claims";
import { getOfferById } from "@/lib/db/offers";
import { getMyPlaidCards } from "@/lib/db/plaid-cards";
import { getPayoutMethod } from "@/lib/db/users-payout";
import { getDinerDwollaAccount } from "@/lib/db/diner-dwolla";
import { centsToUsd } from "@/lib/money";
import { formatDayRange, formatTimeRange } from "@/lib/offers/format";

import { claimOffer } from "../actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function TermsRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-border px-4 py-3.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

export default async function ClaimConfirm({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const profile = await requireRole("diner");
  const { id } = await params;
  const { error } = await searchParams;

  const [offer, activeClaim, cards, payoutMethod, dwolla] = await Promise.all([
    getOfferById(id),
    getActiveClaimForOffer(id),
    getMyPlaidCards(),
    getPayoutMethod(profile.id),
    getDinerDwollaAccount(profile.id),
  ]);
  if (!offer) notFound();

  // Pre-flight: a diner can only earn cash back if a card is linked
  // (so Plaid can confirm the visit) AND a payout destination is set
  // (so we have somewhere to send the cash back). Existing Dwolla
  // users from before the chooser landed are implicitly 'dwolla'.
  const hasLinkedCard = cards.length > 0;
  const hasPayoutDestination =
    payoutMethod === "astra" ||
    payoutMethod === "dwolla" ||
    !!dwolla?.defaultCardFundingSourceUrl;
  const missingSetup = !hasLinkedCard || !hasPayoutDestination;

  const name = offer.restaurant?.name ?? "this restaurant";

  // ---- Conflict: the diner already holds a claim on this offer ----
  if (activeClaim) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-5 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-paprika-tint font-display text-3xl text-paprika">
            !
          </span>
          <Eyebrow className="text-center">Already activated</Eyebrow>
          <Heading as="h1" size="page" className="pb-0">
            You already have an active offer at {name}.
          </Heading>
          <p className="text-sm text-muted-foreground">
            One activation per offer. Your active offer is still good —
            eat, pay with your linked card, and we&apos;ll confirm it.
          </p>
          <div className="space-y-2 pt-2">
            <Link
              href={`/app/claims/${activeClaim.id}`}
              className="block w-full rounded-full bg-ink py-3.5 text-center text-[15px] font-semibold text-bone transition-colors hover:bg-ink-soft"
            >
              View active offer
            </Link>
            <Link
              href="/app"
              className="block w-full py-2 text-center text-sm text-muted-foreground hover:text-ink"
            >
              Browse other restaurants
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ---- Confirm: review terms, then place the claim ----
  return (
    <main className="flex flex-1 items-start justify-center px-6 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-1.5">
          <Eyebrow>Activate offer</Eyebrow>
          <Heading as="h1" size="page">
            {offer.discount_pct}% off at {name}
          </Heading>
        </div>

        <Card flush>
          <TermsRow k="Discount" v={`${offer.discount_pct}% off your check`} />
          <TermsRow
            k="Window"
            v={formatDayRange(offer.valid_days) || "See offer"}
          />
          <TermsRow
            k="Hours"
            v={formatTimeRange(offer.valid_start_time, offer.valid_end_time)}
          />
          {offer.min_check_cents > 0 ? (
            <TermsRow
              k="Minimum"
              v={`${centsToUsd(offer.min_check_cents)} before tax`}
            />
          ) : null}
        </Card>

        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          A small platform fee of 6% of the discounted total (capped at
          $10) is deducted from the discount before cash back is sent.
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {missingSetup ? (
          <Card className="space-y-3 border-paprika/40 bg-paprika-tint">
            <p className="text-sm font-medium text-ink">
              Finish setting up before you activate
            </p>
            <p className="text-sm text-ink/75">
              {!hasLinkedCard
                ? "We watch your linked card to confirm your visit, then send the cash back."
                : "We need somewhere to send the cash back when your visit is confirmed."}
            </p>
            <div className="space-y-2 pt-1">
              {!hasLinkedCard ? (
                <Link
                  href="/app/cards"
                  className="block w-full rounded-full bg-ink py-3 text-center text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
                >
                  Link a card
                </Link>
              ) : null}
              {!hasPayoutDestination ? (
                <Link
                  href="/app/rebates/setup"
                  className="block w-full rounded-full bg-ink py-3 text-center text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
                >
                  Choose where cash back lands
                </Link>
              ) : null}
              <Link
                href={`/app/offers/${offer.id}`}
                className="block w-full py-2 text-center text-sm text-muted-foreground hover:text-ink"
              >
                Cancel
              </Link>
            </div>
          </Card>
        ) : (
          <form action={claimOffer} className="space-y-2">
            <input type="hidden" name="offer_id" value={offer.id} />
            <Button type="submit" size="lg" className="w-full">
              Activate offer
            </Button>
            <Link
              href={`/app/offers/${offer.id}`}
              className="block w-full py-2 text-center text-sm text-muted-foreground hover:text-ink"
            >
              Cancel
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
