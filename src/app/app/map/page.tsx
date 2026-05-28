// Diner map screen — an embedded OpenStreetMap of Dallas with
// offer pins overlaid in their real neighbourhood positions.
//
// The map tiles come from OSM's own embed iframe (no API key, no JS
// dependency). Pins are absolute-positioned siblings of the iframe,
// computed from each restaurant's hardcoded lat/lng. Restaurants
// without a known position fall back to a deterministic scatter near
// the map's centre, so sandbox seed (KFC etc.) still shows.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getLiveOffers } from "@/lib/db/offers";

import { OfferCard, type OfferCardData } from "../OfferCard";

// Bounding box for the embedded OSM map. Covers Bishop Arts (SW)
// through Lower Greenville / Knox-Henderson (NE) — the whole canon
// neighbourhood set with some breathing room.
const BBOX = {
  west: -96.84,
  east: -96.75,
  south: 32.73,
  north: 32.83,
};
const OSM_EMBED = `https://www.openstreetmap.org/export/embed.html?bbox=${BBOX.west}%2C${BBOX.south}%2C${BBOX.east}%2C${BBOX.north}&layer=mapnik`;

// Real lat/lng for each canon restaurant in seed.ts. New restaurants
// fall through to scatterFor() below.
const RESTAURANT_COORDS: Record<string, { lat: number; lng: number }> = {
  "00000000-0000-0000-0000-000000000001": { lat: 32.7464, lng: -96.8276 }, // Lucia
  "00000000-0000-0000-0000-000000000002": { lat: 32.748, lng: -96.8312 }, // Veracruz Cocina
  "00000000-0000-0000-0000-000000000003": { lat: 32.7836, lng: -96.7793 }, // Smoke & Tinder
  "00000000-0000-0000-0000-000000000004": { lat: 32.7836, lng: -96.778 }, // Trompo East
  "00000000-0000-0000-0000-000000000005": { lat: 32.8198, lng: -96.7867 }, // Wendigo Cellar
  "00000000-0000-0000-0000-000000000006": { lat: 32.8166, lng: -96.7843 }, // The Lemon Tree
  "00000000-0000-0000-0000-000000000007": { lat: 32.8077, lng: -96.777 }, // Anchovy & Roe
  "00000000-0000-0000-0000-000000000008": { lat: 32.8083, lng: -96.7771 }, // Tropico
};

/** Deterministic scatter for restaurants we don't have real coords for. */
function scatterFor(id: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  // Stay inside the bbox with some margin.
  const latSpan = (BBOX.north - BBOX.south) * 0.7;
  const lngSpan = (BBOX.east - BBOX.west) * 0.7;
  const lat =
    BBOX.south + (BBOX.north - BBOX.south) * 0.15 + (h % 1000) / 1000 * latSpan;
  const lng =
    BBOX.west +
    (BBOX.east - BBOX.west) * 0.15 +
    ((h >> 10) % 1000) / 1000 * lngSpan;
  return { lat, lng };
}

/** Convert lat/lng into a percentage position inside the bbox. */
function pinPercent(id: string, restaurantId: string | null | undefined): {
  left: number;
  top: number;
} {
  const coords =
    (restaurantId && RESTAURANT_COORDS[restaurantId]) || scatterFor(id);
  const left = ((coords.lng - BBOX.west) / (BBOX.east - BBOX.west)) * 100;
  // Y is inverted — north (high lat) is top of the image.
  const top = ((BBOX.north - coords.lat) / (BBOX.north - BBOX.south)) * 100;
  return { left, top };
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
            Offers nearby
          </Heading>
        </div>

        {/* OpenStreetMap embed + pin overlay */}
        <div className="relative h-72 overflow-hidden rounded-2xl border border-border">
          <iframe
            src={OSM_EMBED}
            title="Map of Dallas"
            loading="lazy"
            className="absolute inset-0 size-full"
          />
          {offers.map((o) => {
            const p = pinPercent(o.id, o.restaurant?.id);
            // Clip to the visible area so pins for stray sandbox rows
            // don't hang off the side.
            if (p.left < 0 || p.left > 100 || p.top < 0 || p.top > 100) {
              return null;
            }
            return (
              <Link
                key={o.id}
                href={`/app/offers/${o.id}`}
                style={{ left: `${p.left}%`, top: `${p.top}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                title={o.restaurant?.name ?? "Offer"}
              >
                <span className="flex size-9 items-center justify-center rounded-full border-2 border-bone bg-paprika text-[11px] font-semibold text-white shadow-md">
                  {o.discount_pct}%
                </span>
              </Link>
            );
          })}
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
