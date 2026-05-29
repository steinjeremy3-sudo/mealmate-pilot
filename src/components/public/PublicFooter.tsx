// Shared footer across marketing + public-browse surfaces. Carries a
// quiet wordmark, tagline, the legal links, and the copyright line.

import Link from "next/link";

import { Wordmark } from "@/components/brand";

export function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-bone-deep">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Brand + tagline */}
        <div className="space-y-3">
          <Wordmark />
          <p className="font-display text-2xl leading-tight tracking-[-0.02em]">
            Dine well. Pay less.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A small team based in Dallas, building card-linked
            discounts for independent restaurants. Launching summer
            2026.
          </p>
        </div>
      </div>

      <div className="border-t border-border bg-ink py-5 text-bone">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 font-mono text-[11px] uppercase tracking-[0.1em] text-bone/65">
          <span>© Mealmate Inc. 2026 · Built in Dallas</span>
          <div className="flex flex-wrap gap-5">
            <Link
              href="/browse"
              className="transition-colors hover:text-bone"
            >
              Browse offers
            </Link>
            <Link
              href="/for-restaurants"
              className="transition-colors hover:text-bone"
            >
              For restaurants
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-bone"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-bone"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
