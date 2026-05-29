// Restaurant photo placeholder. Until restaurants supply their own
// photography, we hot-link a real food photo from Unsplash keyed by
// the restaurant name — same name → same photo every render. The
// IDs below were extracted from Unsplash's "Food & Drink" topic feed
// and verified to resolve via the imgix CDN.
//
// Long-term plan: add a `restaurants.photo_url` column and prefer
// it here when set, falling back to this curated pool until a real
// photo lands.
//
// Plain <img> (not next/image) on purpose: keeps next.config out of
// it for a placeholder we plan to replace.

import { cn } from "@/lib/utils";

export type PlaceholderImgProps = {
  /** Restaurant name — seeds the placeholder photo, shown if showName. */
  name: string;
  /**
   * A real uploaded photo URL. When set it's shown instead of the
   * generated placeholder; null/undefined falls back to the pool.
   */
  src?: string | null;
  /** Small line under the name when showName is set (e.g. "Italian · Bishop Arts"). */
  caption?: string;
  /** Corner tag. Empty string (the default) hides it. */
  label?: string;
  /** Render the restaurant name across the bottom of the panel. */
  showName?: boolean;
  /** Sizing + radius come from the caller. */
  className?: string;
};

// Curated set of real food photos from Unsplash's Food & Drink topic.
// All verified to resolve via the imgix CDN with a clean URL (no
// signed ixid params required).
const FOOD_PHOTOS = [
  "1758979690131-11e2aa0b142b",
  "1758380742009-163a0deee80e",
  "1758221055840-be5dfa05699d",
  "1758221054864-8c8737821bfd",
  "1757752463419-4f0788b2b544",
  "1757519740947-eef07a74c4ab",
  "1757450296755-f875c2dc80bf",
  "1756551399655-207569477340",
  "1756260853158-a63f71b4bff6",
  "1756523854214-9191eb30eb1e",
  "1756260897470-f5b9f4af80c7",
  "1756292024340-a7ca44eb8e5d",
  "1756395080881-a6e83b582509",
  "1756395194652-96bc660d0a50",
  "1756334830608-32905156d724",
  "1756383254040-d19dbc1d4cb1",
  "1756260897483-7cfc313b7534",
  "1756300217545-b9860909057b",
];

function pickPhoto(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const id = FOOD_PHOTOS[h % FOOD_PHOTOS.length];
  return `https://images.unsplash.com/photo-${id}?w=800&q=75&fit=crop&auto=format`;
}

export function PlaceholderImg({
  name,
  src,
  caption,
  label = "",
  showName = false,
  className,
}: PlaceholderImgProps) {
  const imgSrc = src || pickPhoto(name);
  const needsOverlay = showName || !!label;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-bone-deep",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element --
        plain <img> on purpose: either an Unsplash placeholder hot-link
        or a merchant photo from Supabase Storage's public CDN. Using
        <Image> would mean whitelisting both hosts in next.config and
        routing through the optimizer for little gain here. */}
      <img
        src={imgSrc}
        alt=""
        className="absolute inset-0 size-full object-cover"
        loading="lazy"
      />
      {needsOverlay ? (
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
          aria-hidden
        />
      ) : null}
      {label ? (
        <span className="absolute left-3 top-3 rounded bg-black/40 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-bone backdrop-blur-sm">
          {label}
        </span>
      ) : null}
      {showName ? (
        <div className="absolute inset-x-3.5 bottom-3.5 text-bone">
          <p className="font-display text-lg leading-tight tracking-[-0.02em]">
            {name}
          </p>
          {caption ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-bone/75">
              {caption}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
