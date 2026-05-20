"use client";

// Home browse — cuisine filter chips over the live-offer list.
// Client component: chip selection filters instantly, no round-trip.

import { useMemo, useState } from "react";

import { Card, Chip } from "@/components/brand";

import { OfferCard, type OfferCardData } from "./OfferCard";

export function OfferBrowse({ offers }: { offers: OfferCardData[] }) {
  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const o of offers) {
      if (o.restaurant?.cuisine) set.add(o.restaurant.cuisine);
    }
    return [...set].sort();
  }, [offers]);

  const [active, setActive] = useState<string | null>(null);

  const shown = active
    ? offers.filter((o) => o.restaurant?.cuisine === active)
    : offers;

  return (
    <div className="space-y-4">
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

      {shown.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-muted-foreground">
          Nothing in that category right now.
        </Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((o) => (
            <li key={o.id}>
              <OfferCard offer={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
