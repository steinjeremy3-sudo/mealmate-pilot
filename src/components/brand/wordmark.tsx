// The Mealmate wordmark — Archivo Black, title case, with the brand
// smile `:)` always trailing. The smile inherits the wordmark colour
// (never recolours on its own per the v2.0 kit), runs tight, and has
// kerning disabled so the two glyphs don't auto-collide. Default
// colour is ink-on-bone; pass `text-bone` via className on ink or
// paprika surfaces.

import Link from "next/link";

import { cn } from "@/lib/utils";

function Smile() {
  // currentColor, -0.08em letter-spacing, kerning off — copied from
  // the kit's `.wordmark .smile` rule. Baseline-aligned with the
  // wordmark via inline-flex on the parent.
  return (
    <span
      className="tracking-[-0.08em]"
      style={{ fontFeatureSettings: '"kern" 0' }}
      aria-hidden
    >
      :)
    </span>
  );
}

export function Wordmark({
  href,
  className,
}: {
  /** When set, renders as a link. */
  href?: string;
  className?: string;
}) {
  const baseClass = cn(
    "inline-flex items-baseline gap-[0.12em] font-display text-[26px] leading-none tracking-[-0.025em] text-ink",
    className,
  );
  const content = (
    <>
      <span>Mealmate</span>
      <Smile />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={baseClass} aria-label="Mealmate">
        {content}
      </Link>
    );
  }
  return (
    <span className={baseClass} aria-label="Mealmate">
      {content}
    </span>
  );
}
