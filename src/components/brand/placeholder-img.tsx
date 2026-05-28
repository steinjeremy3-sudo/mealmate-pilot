// Restaurant photo placeholder. Pulls a deterministic image from
// Lorem Picsum keyed by the restaurant name — same name → same photo
// every render. Picsum serves random (not food-specific) shots; the
// long-term plan is to add `restaurants.photo_url` and read it here
// when set, falling back to the placeholder until a real photo lands.
//
// The Picsum CDN is stable, free, and requires no attribution; using
// a plain <img> tag (not next/image) keeps next.config out of it.

import { cn } from "@/lib/utils";

export type PlaceholderImgProps = {
  /** Restaurant name — seeds the photo selection, shown if showName. */
  name: string;
  /** Small line under the name when showName is set (e.g. "Italian · Bishop Arts"). */
  caption?: string;
  /** Corner tag. Empty string (the default) hides it. */
  label?: string;
  /** Render the restaurant name across the bottom of the panel. */
  showName?: boolean;
  /** Sizing + radius come from the caller. */
  className?: string;
};

function nameSeed(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  // Keep the seed under 4 digits — Picsum has a finite catalog and
  // bigger numbers cycle predictably anyway.
  return h % 1000;
}

export function PlaceholderImg({
  name,
  caption,
  label = "",
  showName = false,
  className,
}: PlaceholderImgProps) {
  const seed = nameSeed(name);
  // 800×600 is wide enough to look sharp on the hero crops (~600px wide)
  // and small enough to download fast on the tiny avatar uses (~44px).
  const src = `https://picsum.photos/seed/mm-${seed}/800/600`;

  const needsOverlay = showName || !!label;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-bone-deep",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element --
        plain <img> on purpose: this is a placeholder hot-link to
        picsum.photos. Switching to <Image> would mean whitelisting
        the host in next.config and going through the optimizer, all
        for a placeholder we plan to replace with real photos. */}
      <img
        src={src}
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
