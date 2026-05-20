// Shared restaurant-first offer card. Plain presentational component
// (no hooks) so both server pages and client browse/search can use it.

import Link from "next/link";

import { Card } from "@/components/brand";
import { centsToUsd } from "@/lib/money";

export type OfferCardData = {
  id: string;
  title: string;
  discount_pct: number;
  min_check_cents: number;
  restaurant: {
    name: string;
    neighborhood: string;
    cuisine: string;
  } | null;
};

export function OfferCard({ offer }: { offer: OfferCardData }) {
  return (
    <Link href={`/app/offers/${offer.id}`} className="block">
      <Card className="transition-colors hover:bg-cream-warm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate font-serif text-lg font-medium tracking-tight">
              {offer.restaurant?.name ?? "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {offer.restaurant?.cuisine ?? "—"} ·{" "}
              {offer.restaurant?.neighborhood ?? "—"}
            </p>
            <p className="text-sm text-foreground/80">{offer.title}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-serif text-3xl font-medium leading-none text-orange">
              {offer.discount_pct}%
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">off</p>
          </div>
        </div>
        {offer.min_check_cents > 0 ? (
          <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
            Min spend {centsToUsd(offer.min_check_cents)}
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
