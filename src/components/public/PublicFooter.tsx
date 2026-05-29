// Shared footer across marketing + public-browse surfaces. Carries
// the launch-list signup, a quiet wordmark, the contact email, and
// the copyright line.

import Link from "next/link";

import { Wordmark } from "@/components/brand";
import { LaunchSignup } from "./LaunchSignup";

export function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-bone-deep">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-14 md:grid-cols-[1.2fr_1fr]">
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

        {/* Launch list */}
        <div className="space-y-3">
          <p className="font-display text-xl">Get launch updates</p>
          <LaunchSignup />
          <p className="text-xs text-muted-foreground">
            Occasional updates from Dallas. No marketing email.
          </p>
        </div>
      </div>

      <div className="border-t border-border bg-ink py-5 text-bone">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 font-mono text-[11px] uppercase tracking-[0.1em] text-bone/65">
          <span>© Mealmate Inc. 2026 · Built in Dallas</span>
          <div className="flex gap-5">
            <Link
              href="/browse"
              className="transition-colors hover:text-bone"
            >
              Browse offers
            </Link>
            <a
              href="mailto:jeremy@mealmatedining.com"
              className="transition-colors hover:text-bone"
            >
              jeremy@mealmatedining.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
