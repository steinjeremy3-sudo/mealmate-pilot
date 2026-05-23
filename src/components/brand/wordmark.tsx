// The MealMate wordmark — Fraunces lowercase, orange, no italic.
// Used in the merchant + admin sidebars and on auth screens. Keep
// this as the single source of truth so the logo stays consistent
// across the platform.

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
    "font-serif text-[26px] font-medium tracking-tight text-orange",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={baseClass}>
        mealmate
      </Link>
    );
  }
  return <span className={baseClass}>mealmate</span>;
}
