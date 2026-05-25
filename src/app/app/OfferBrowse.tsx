"use client";

// Diner home browse. Cuisine filter chips over the live offers.
//   - No filter  → editorial sections: a featured pick, a "Near you"
//                  grid, and a "20%+ off" list.
//   - Filter set → a flat filtered list of rows.
// Client component: chip selection filters instantly, no round-trip.

import { useMemo, useState } from "react";

import { Card, Chip } from "@/components/brand";

import { HeroOffer, OfferCard, OfferTile, type OfferCardData } from "./OfferCard";

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[22px] font-medium leading-tight tracking-tight [&_em]:not-italic [&_em]:text-paprika">
      {children}
    </h2>
  );
}

export function OfferBrowse({
  offers,
  preferredCuisines = [],
}: {
  offers: OfferCardData[];
  preferredCuisines?: string[];
}) {
  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const o of offers) {
      if (o.restaurant?.cuisine) set.add(o.restaurant.cuisine);
    }
    return [...set].sort();
  }, [offers]);

  const [active, setActive] = useState<string | null>(null);

  const filtered = active
    ? offers.filter((o) => o.restaurant?.cuisine === active)
    : null;

  const hero = offers[0];
  const nearYou = offers.slice(1, 5);
  const bigDiscount = offers.filter((o) => o.discount_pct >= 20).slice(0, 4);

  const prefSet = new Set(preferredCuisines);
  const forYou =
    prefSet.size > 0
      ? offers
          .filter((o) => o.restaurant && prefSet.has(o.restaurant.cuisine))
          .slice(0, 4)
      : [];

  return (
    <div className="space-y-7">
      {/* Filter chips — horizontal scroll, bleeds to the screen edge. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip active={active === null} onClick={() => setActive(null)}>
          All
        </Chip>
        {cuisines.map((c) => (
          <Chip
            key={c}
            active={active === c}
            onClick={() => setActive(active === c ? null : c)}
          >
            {c}
          </Chip>
        ))}
      </div>

      {filtered ? (
        filtered.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            Nothing in that category right now.
          </Card>
        ) : (
          <ul className="space-y-3">
            {filtered.map((o) => (
              <li key={o.id}>
                <OfferCard offer={o} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          {forYou.length > 0 ? (
            <section className="space-y-3">
              <SectionHead>
                For <em>you</em>
              </SectionHead>
              <ul className="space-y-3">
                {forYou.map((o) => (
                  <li key={o.id}>
                    <OfferCard offer={o} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hero ? (
            <section className="space-y-3">
              <SectionHead>
                Tonight&apos;s <em>pick</em>
              </SectionHead>
              <HeroOffer offer={hero} />
            </section>
          ) : null}

          {nearYou.length > 0 ? (
            <section className="space-y-3">
              <SectionHead>Near you</SectionHead>
              <div className="grid grid-cols-2 gap-3">
                {nearYou.map((o) => (
                  <OfferTile key={o.id} offer={o} />
                ))}
              </div>
            </section>
          ) : null}

          {bigDiscount.length > 0 ? (
            <section className="space-y-3">
              <SectionHead>
                20%+ off <em>tonight</em>
              </SectionHead>
              <ul className="space-y-3">
                {bigDiscount.map((o) => (
                  <li key={o.id}>
                    <OfferCard offer={o} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
