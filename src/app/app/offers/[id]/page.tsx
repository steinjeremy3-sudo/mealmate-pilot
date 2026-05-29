// Diner: restaurant + offer detail.
//
// Restaurant-first layout — hero image, the restaurant, then the offer
// as a dark "active offer" card. The Claim CTA opens the confirm step;
// if the diner already holds a claim, an active-claim panel shows here.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireRole } from "@/lib/auth/require-role";
import {
  Card,
  Eyebrow,
  PlaceholderImg,
  buttonVariants,
} from "@/components/brand";
import { expiresInMinutes, getActiveClaimForOffer } from "@/lib/db/claims";
import { getMenuForRestaurant } from "@/lib/db/menu";
import { getOfferById } from "@/lib/db/offers";
import { getRemainingForOffer } from "@/lib/db/offer-remaining";
import { centsToUsd } from "@/lib/money";
import {
  formatDayRange,
  formatDays,
  formatTimeRange,
} from "@/lib/offers/format";

import { cancelClaim } from "../../claims/actions";

type Params = Promise<{ id: string }>;

function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-border px-4 py-3.5 text-sm last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export default async function DinerOfferDetail({
  params,
}: {
  params: Params;
}) {
  await requireRole("diner");
  const { id } = await params;

  const [offer, activeClaim] = await Promise.all([
    getOfferById(id),
    getActiveClaimForOffer(id),
  ]);
  if (!offer) notFound();

  const [menu, remaining] = await Promise.all([
    getMenuForRestaurant(offer.restaurant_id),
    getRemainingForOffer(offer),
  ]);
  const r = offer.restaurant;
  const name = r?.name ?? "Restaurant";
  const dayRange = formatDayRange(offer.valid_days);
  const timeRange = formatTimeRange(
    offer.valid_start_time,
    offer.valid_end_time,
  );

  return (
    <main className="mx-auto w-full max-w-md">
      {/* Hero */}
      <div className="relative">
        <PlaceholderImg
          name={name}
          caption={r ? `${r.cuisine} · ${r.neighborhood}` : undefined}
          showName
          className="h-64"
        />
        <Link
          href="/app"
          aria-label="Back"
          className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-full bg-bone text-ink shadow-sm transition-colors hover:bg-bone-deep"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </Link>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="space-y-3">
          <Eyebrow>
            {r ? `${r.cuisine} · ${r.neighborhood}` : "Offer"}
          </Eyebrow>
          <h1 className="pb-1 font-display text-[32px] font-medium leading-[1.1] tracking-tight">
            {name}
          </h1>
          {offer.description ? (
            <p className="text-base text-foreground/80">
              {offer.description}
            </p>
          ) : null}
        </div>

        {/* Active offer — dark card */}
        <div className="space-y-3 rounded-2xl bg-ink p-5 text-bone">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Eyebrow tone="muted" className="text-bone/60">
                Active offer
              </Eyebrow>
              <p className="mt-1.5 font-display text-3xl text-paprika">
                {offer.discount_pct}% off
              </p>
            </div>
            {dayRange ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-paprika px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.05em] text-white">
                {dayRange}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-bone/70">
            Valid {timeRange}
            {offer.min_check_cents > 0
              ? ` · Minimum check ${centsToUsd(offer.min_check_cents)}`
              : ""}{" "}
            · Dine-in
          </p>
          {remaining != null ? (
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-paprika">
              {remaining === 0 ? "Fully booked" : `${remaining} left`}
            </p>
          ) : null}
        </div>

        {/* Restaurant facts */}
        <Card flush>
          <dl>
            <InfoRow k="Hours" v={timeRange} />
            <InfoRow k="Days" v={formatDays(offer.valid_days)} />
            {r?.address ? <InfoRow k="Address" v={r.address} /> : null}
          </dl>
        </Card>

        {/* Menu preview */}
        {menu.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Eyebrow tone="muted">Menu</Eyebrow>
              <Link
                href={`/app/offers/${offer.id}/menu`}
                className="text-xs text-paprika underline underline-offset-4"
              >
                See full menu →
              </Link>
            </div>
            <Card flush>
              {menu.slice(0, 4).map((item) => {
                const discountedCents = Math.round(
                  item.priceCents * (1 - offer.discount_pct / 100),
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
                  >
                    <span>{item.name}</span>
                    <span className="flex items-baseline gap-2 font-mono">
                      <s className="text-muted-foreground">
                        {centsToUsd(item.priceCents)}
                      </s>
                      <span className="text-paprika">
                        {centsToUsd(discountedCents)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </Card>
          </div>
        ) : null}

        {/* Claim */}
        {activeClaim ? (
          <Card className="space-y-3 border-paprika/30 bg-paprika-tint text-center">
            <div className="space-y-1">
              <p className="font-medium text-ink">
                You&apos;ve activated this offer.
              </p>
              <p className="text-xs text-ink/70">
                Expires in {expiresInMinutes(activeClaim)} min. Eat at the
                restaurant and pay with your linked card.
              </p>
              <Link
                href={`/app/claims/${activeClaim.id}`}
                className="inline-block text-xs text-paprika underline underline-offset-4"
              >
                See your offer →
              </Link>
            </div>
            <form action={cancelClaim} className="border-t border-border pt-3">
              <input type="hidden" name="claim_id" value={activeClaim.id} />
              <button
                type="submit"
                className="cursor-pointer text-xs text-ink/70 underline underline-offset-4 hover:text-ink"
              >
                Cancel this offer
              </button>
            </form>
          </Card>
        ) : remaining === 0 ? (
          <div className="space-y-2">
            <div
              aria-disabled
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "pointer-events-none w-full opacity-60",
              })}
            >
              Fully booked
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Every spot is taken right now. Check back — slots free up
              when activations expire.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Link
              href={`/app/offers/${offer.id}/claim`}
              className={buttonVariants({ size: "lg", className: "w-full" })}
            >
              Activate {offer.discount_pct}% off
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              An activated offer holds for an hour. Eat, pay at the
              restaurant, get cash back.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
