// The Mealmate wordmark — Archivo Black, title case, no period.
// Default colour is ink-on-bone (the kit's locked default); pass a
// `text-bone` className when placing on an ink/paprika surface. Used
// in the dashboard + admin sidebars and on the auth screens. Single
// source of truth so the logo stays consistent across the platform.

import Link from "next/link";

import { cn } from "@/lib/utils";

export function Wordmark({
  href,
  className,
}: {
  /** When set, renders as a link. */
  href?: string;
  className?: string;
}) {
  const baseClass = cn(
    "font-display text-[26px] leading-none tracking-[-0.025em] text-ink",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={baseClass}>
        Mealmate
      </Link>
    );
  }
  return <span className={baseClass}>Mealmate</span>;
}
