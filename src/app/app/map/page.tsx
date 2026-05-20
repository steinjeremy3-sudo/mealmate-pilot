// Diner map screen.
//
// The map itself is a STYLED MOCK — a decorative panel with pins, not
// a geographic map. We don't store restaurant coordinates; pin
// positions are a deterministic scatter from the offer id. A real
// interactive map would need a maps provider + lat/lng (a future
// task). The offer list below is the functional part.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getLiveOffers } from "@/lib/db/offers";

import { OfferCard, type OfferCardData } from "../OfferCard";

/** Deterministic, edge-avoiding scatter for a pin, from the offer id. */
function pinPosition(id: string): { left: number; top: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return { left: 12 + (h % 76), top: 16 + ((h >> 8) % 62) };
}

export default async function DinerMapPage() {
  await requireRole("diner");
  const offers = (await getLiveOffers()) as OfferCardData[];

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Map · Dallas</Eyebrow>
          <Heading as="h1" size="page">
            Offers <em>nearby</em>
          </Heading>
        </div>

        {/* Decorative map panel — faint grid + offer pins. */}
        <div
          className="relative h-64 overflow-hidden rounded-2xl border border-border bg-cream-warm"
          style={{
            backgroundImage:
              "linear-gradient(rgba(26,26,31,0.04) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(26,26,31,0.04) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        >
          {offers.map((o) => {
            const p = pinPosition(o.id);
            return (
              <Link
                key={o.id}
                href={`/app/offers/${o.id}`}
                style={{ left: `${p.left}%`, top: `${p.top}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                title={o.restaurant?.name ?? "Offer"}
              >
                <span className="flex size-9 items-center justify-center rounded-full border-2 border-cream bg-orange text-[11px] font-semibold text-white shadow-sm">
                  {o.discount_pct}%
                </span>
              </Link>
            );
          })}
          {offers.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No offers to map.
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <Eyebrow tone="muted">
            {offers.length} offer{offers.length === 1 ? "" : "s"} nearby
          </Eyebrow>
          {offers.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted-foreground">
              Nothing live right now.
            </Card>
          ) : (
            <ul className="space-y-3">
              {offers.map((o) => (
                <li key={o.id}>
                  <OfferCard offer={o} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
