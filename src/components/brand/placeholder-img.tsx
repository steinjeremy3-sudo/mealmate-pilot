// Restaurant-photo placeholder per the v2.0 kit — a bone-deep panel
// with 45° hatched ink stripes. Reads clearly as a stand-in, not a
// real photo. The production schema has no restaurant imagery yet;
// drop this anywhere a hero would go.

import { cn } from "@/lib/utils";

export type PlaceholderImgProps = {
  /** Restaurant name — shown if showName. */
  name: string;
  /** Small line under the name when showName is set (e.g. "Italian · Bishop Arts"). */
  caption?: string;
  /** Corner tag. Empty string (the default) hides it. */
  label?: string;
  /** Render the restaurant name across the bottom of the panel. */
  showName?: boolean;
  /** Light caption text — when the panel sits on a dark surface. */
  dark?: boolean;
  /** Sizing + radius come from the caller. */
  className?: string;
};

const STRIPES =
  "repeating-linear-gradient(45deg, transparent 0 12px, rgba(10,10,10,0.06) 12px 13px)";

export function PlaceholderImg({
  name,
  caption,
  label = "",
  showName = false,
  dark = false,
  className,
}: PlaceholderImgProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-bone-deep",
        className,
      )}
    >
      <div
        className="absolute inset-0"
        style={{ background: STRIPES }}
        aria-hidden
      />
      {label ? (
        <span className="absolute left-3 top-3 rounded bg-bone/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/55 backdrop-blur-sm">
          {label}
        </span>
      ) : null}
      {showName ? (
        <div className="absolute inset-x-3.5 bottom-3.5">
          <p
            className={cn(
              "font-display text-lg leading-tight tracking-[-0.02em]",
              dark ? "text-bone" : "text-ink",
            )}
          >
            {name}
          </p>
          {caption ? (
            <p
              className={cn(
                "mt-1 font-mono text-[10px] uppercase tracking-[0.1em]",
                dark ? "text-bone/60" : "text-ink/55",
              )}
            >
              {caption}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
