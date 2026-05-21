// Textured restaurant-photo placeholder — a tinted, striped panel that
// reads clearly as a stand-in, not a real photo. The production schema
// has no restaurant imagery yet; the design bundle uses this pattern
// everywhere a hero image would go. Tone is derived deterministically
// from the restaurant name, so a given restaurant always renders the
// same panel.

import { cn } from "@/lib/utils";

type Tone = "warm" | "sage" | "cream";

const TONES: Tone[] = ["warm", "sage", "cream"];

function toneFor(seed: string): Tone {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TONES[h % TONES.length];
}

export type PlaceholderImgProps = {
  /** Restaurant name — seeds the tone, and shows as a caption if showName. */
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

export function PlaceholderImg({
  name,
  caption,
  label = "",
  showName = false,
  dark = false,
  className,
}: PlaceholderImgProps) {
  const tone = toneFor(name);
  const bg =
    tone === "sage"
      ? "var(--sage-tint)"
      : tone === "cream"
        ? "var(--cream-soft)"
        : "var(--cream-warm)";
  const accent =
    tone === "sage" ? "rgba(122,150,112,0.35)" : "rgba(232,117,74,0.35)";
  const stripes = `repeating-linear-gradient(135deg, transparent 0 22px, ${accent} 22px 23px)`;

  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      style={{ background: bg }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{ background: stripes }}
        aria-hidden
      />
      {label ? (
        <span className="absolute left-3 top-3 rounded bg-cream/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/55 backdrop-blur-sm">
          {label}
        </span>
      ) : null}
      {showName ? (
        <div className="absolute inset-x-3.5 bottom-3.5">
          <p
            className={cn(
              "font-serif text-lg italic leading-tight",
              dark ? "text-cream-soft" : "text-ink",
            )}
          >
            {name}
          </p>
          {caption ? (
            <p
              className={cn(
                "mt-1 font-mono text-[10px] uppercase tracking-[0.1em]",
                dark ? "text-cream/55" : "text-ink/55",
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
