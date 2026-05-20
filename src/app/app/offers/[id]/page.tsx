// Diner: offer detail with claim button.
//
// Shows a Claim button when the diner doesn't have an active claim, or
// an "already claimed — expires in N min" panel when they do.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import { expiresInMinutes, getActiveClaimForOffer } from "@/lib/db/claims";
import { getOfferById } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

import { cancelClaim } from "../../claims/actions";
import { claimOffer } from "./actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function formatDays(days: string[]): string {
  const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const FULL: Record<string, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };
  const sorted = [...days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return sorted.map((d) => FULL[d] ?? d).join(", ");
}

function formatTime(t: string): string {
  const [hStr, m] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

export default async function DinerOfferDetail({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole("diner");
  const { id } = await params;
  const { error } = await searchParams;

  const [offer, activeClaim] = await Promise.all([
    getOfferById(id),
    getActiveClaimForOffer(id),
  ]);
  if (!offer) notFound();

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/app"
          className="text-sm text-muted-foreground transition-colors hover:text-orange"
        >
          ← Back
        </Link>

        <div className="space-y-2">
          <Eyebrow>{offer.restaurant?.name ?? "—"}</Eyebrow>
          <Heading as="h1" size="page">
            {offer.title}
          </Heading>
          <p className="text-base text-foreground/80">{offer.description}</p>
        </div>

        {/* Discount hero — dark ink surface echoing the prototype hero. */}
        <Card flush className="bg-ink px-7 py-8 text-center">
          <p className="font-serif text-6xl font-medium leading-none text-orange">
            {offer.discount_pct}%
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/60">
            off your check
          </p>
        </Card>

        <Card className="space-y-2 text-sm">
          {offer.min_check_cents > 0 ? (
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Minimum spend</dt>
              <dd>{centsToUsd(offer.min_check_cents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-muted-foreground">Days</dt>
            <dd className="text-right">{formatDays(offer.valid_days)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-muted-foreground">Hours</dt>
            <dd>
              {formatTime(offer.valid_start_time)} –{" "}
              {formatTime(offer.valid_end_time)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Where</dt>
            <dd className="text-right">
              {offer.restaurant?.address ?? "—"}
              <br />
              <span className="text-muted-foreground">
                {offer.restaurant?.neighborhood ?? "—"}
              </span>
            </dd>
          </div>
        </Card>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {activeClaim ? (
          <Card className="space-y-3 border-sage/40 bg-sage-tint text-center">
            <div className="space-y-1">
              <p className="font-medium text-ink">
                You&apos;ve claimed this offer.
              </p>
              <p className="text-xs text-ink/70">
                Expires in {expiresInMinutes(activeClaim)} min. Eat at the
                restaurant and pay with your linked card.
              </p>
              <Link
                href="/app/claims"
                className="inline-block text-xs text-sage underline underline-offset-4"
              >
                See all your claims →
              </Link>
            </div>
            <form
              action={cancelClaim}
              className="border-t border-sage/30 pt-3"
            >
              <input type="hidden" name="claim_id" value={activeClaim.id} />
              <button
                type="submit"
                className="cursor-pointer text-xs text-ink/70 underline underline-offset-4 hover:text-ink"
              >
                Cancel this claim
              </button>
            </form>
          </Card>
        ) : (
          <form action={claimOffer} className="space-y-2">
            <input type="hidden" name="offer_id" value={offer.id} />
            <Button type="submit" size="lg" className="w-full">
              Claim this offer
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Claims hold for 1 hour. Eat, pay at the restaurant, get cash
              back.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
