// Diner offer cards — three restaurant-first variants from the design
// bundle. Plain presentational components (no hooks) so server pages
// and the client browse/search can both use them.
//
//   OfferCard  — full-width list row (search results, "20%+" section)
//   OfferTile  — 2-column grid tile, image on top ("Near you")
//   HeroOffer  — dark featured card ("Tonight's pick")

import Link from "next/link";

import { Eyebrow, PlaceholderImg } from "@/components/brand";
import { formatDayRange } from "@/lib/offers/format";
import { dinerDisplayPct, netifyDiscountCopy } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type OfferCardData = {
  id: string;
  title: string;
  discount_pct: number;
  min_check_cents: number;
  valid_days: string[];
  /** Redemption slots left (null = uncapped; omit the urgency badge). */
  remaining?: number | null;
  restaurant: {
    id: string;
    name: string;
    neighborhood: string;
    cuisine: string;
    photo_url?: string | null;
  } | null;
};

/** The paprika brand pill: "25% OFF". */
export function DiscountPill({ pct }: { pct: number }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-paprika px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.05em] text-white">
      {pct}% OFF
    </span>
  );
}

/** "12 LEFT" urgency note. Renders nothing for uncapped offers. */
export function LeftNote({
  remaining,
  className,
}: {
  remaining?: number | null;
  className?: string;
}) {
  if (remaining == null) return null;
  return (
    <span
      className={cn(
        "font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-paprika",
        className,
      )}
    >
      {remaining === 0 ? "Fully booked" : `${remaining} left`}
    </span>
  );
}

export function OfferCard({
  offer,
  href,
}: {
  offer: OfferCardData;
  /** Override the default link target (e.g. /r/[id] for public browse). */
  href?: string;
}) {
  const r = offer.restaurant;
  return (
    <Link href={href ?? `/app/offers/${offer.id}`} className="block">
      <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-bone p-3 transition-colors hover:bg-bone-deep">
        <PlaceholderImg
          name={r?.name ?? "Restaurant"} src={r?.photo_url}
          className="size-20 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-snug">
            {r?.name ?? "—"}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {r?.cuisine ?? "—"} · {r?.neighborhood ?? "—"}
          </p>
          <p className="mt-1.5 truncate text-sm text-foreground/75">
            {netifyDiscountCopy(offer.title, offer.discount_pct)}
          </p>
          <LeftNote remaining={offer.remaining} className="mt-1 block" />
        </div>
        <DiscountPill pct={dinerDisplayPct(offer.discount_pct)} />
      </div>
    </Link>
  );
}

export function OfferTile({
  offer,
  href,
}: {
  offer: OfferCardData;
  href?: string;
}) {
  const r = offer.restaurant;
  return (
    <Link href={href ?? `/app/offers/${offer.id}`} className="block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-bone transition-colors hover:bg-bone-deep">
        <PlaceholderImg name={r?.name ?? "Restaurant"} src={r?.photo_url} className="h-28" />
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <p className="truncate font-display text-base leading-snug">
            {r?.name ?? "—"}
          </p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {r?.cuisine ?? "—"}
          </p>
          <span className="mt-auto flex items-center gap-2">
            <span className="inline-flex w-fit items-center rounded-full bg-paprika-tint px-2.5 py-1 text-[11px] font-semibold text-paprika-deep">
              {dinerDisplayPct(offer.discount_pct)}% off
            </span>
            <LeftNote remaining={offer.remaining} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function HeroOffer({
  offer,
  href,
}: {
  offer: OfferCardData;
  href?: string;
}) {
  const r = offer.restaurant;
  const dayRange = formatDayRange(offer.valid_days);
  return (
    <Link href={href ?? `/app/offers/${offer.id}`} className="block">
      <div className="relative overflow-hidden rounded-2xl bg-ink p-5 text-bone transition-transform active:scale-[0.99]">
        <PlaceholderImg name={r?.name ?? "Restaurant"} src={r?.photo_url} className="h-36 rounded-xl" />
        <span className="absolute right-7 top-7">
          <DiscountPill pct={dinerDisplayPct(offer.discount_pct)} />
        </span>
        <div className="mt-3.5 space-y-1.5">
          <Eyebrow>{dayRange ? `Tonight only · ${dayRange}` : "Tonight only"}</Eyebrow>
          <p className="font-display text-2xl leading-tight">{r?.name ?? "—"}</p>
          <p className="text-sm text-bone/60">
            {r?.cuisine ?? "—"} · {r?.neighborhood ?? "—"}
          </p>
          <LeftNote remaining={offer.remaining} className="block pt-0.5" />
        </div>
      </div>
    </Link>
  );
}
