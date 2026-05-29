// Public browse — every live offer from an approved restaurant,
// visible without an account. Tap a card to view the restaurant page
// + menu; the activate CTA on /r/[id] kicks anon visitors to /sign-up.

import { Eyebrow } from "@/components/brand";
import { OfferTile, type OfferCardData } from "@/app/app/OfferCard";
import { getLiveOffers } from "@/lib/db/offers";

export default async function PublicBrowsePage() {
  const offers = (await getLiveOffers()) as OfferCardData[];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-8 space-y-2">
        <Eyebrow>Tonight in Dallas</Eyebrow>
        <h1 className="font-display text-[2.25rem] leading-[1.05] tracking-[-0.02em]">
          {offers.length} offer{offers.length === 1 ? "" : "s"} live
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Browse what every Mealmate partner is running tonight.
          Sign up free to activate one — cash back lands on your
          linked card a day or two later.
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-bone-deep p-12 text-center text-sm text-muted-foreground">
          Nothing live right now — check back soon.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {offers.map((o) => (
            <li key={o.id}>
              <OfferTile
                offer={o}
                href={o.restaurant ? `/r/${o.restaurant.id}` : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
