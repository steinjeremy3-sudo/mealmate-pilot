// Diner home — Phase 2b: browse live offers from approved restaurants.
//
// Tapping an offer opens the detail page (Phase 2b). Claim button arrives
// in Phase 2c.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getDinerRebateBannerSummary } from "@/lib/db/diner-rebate-status";
import { getLiveOffers } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

export default async function DinerHome() {
  const profile = await requireRole("diner");
  const [offers, rebateBanner] = await Promise.all([
    getLiveOffers(),
    getDinerRebateBannerSummary(profile.id),
  ]);
  const showRebateSetupBanner =
    !rebateBanner.hasDestination && rebateBanner.initiatedCents > 0;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">
        {showRebateSetupBanner ? (
          <Link
            href="/app/rebates/setup"
            className="block rounded-md border border-emerald-300 bg-emerald-50 p-4 hover:bg-emerald-100"
          >
            <p className="font-medium text-emerald-900">
              You have {centsToUsd(rebateBanner.initiatedCents)} in rebates
              waiting.
            </p>
            <p className="text-xs text-emerald-800 mt-1">
              Pick a checking account to receive them →
            </p>
          </Link>
        ) : null}

        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Live offers in Dallas
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {offers.length === 0 ? "No offers right now." : `${offers.length} live`}
          </h1>
        </div>

        {offers.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            Check back soon. New offers appear here as restaurants publish them.
          </p>
        ) : (
          <ul className="space-y-3">
            {offers.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/app/offers/${o.id}`}
                  className="block rounded-lg border border-border p-4 hover:bg-secondary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium truncate">{o.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {o.restaurant?.name ?? "—"} ·{" "}
                        {o.restaurant?.neighborhood ?? "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-serif text-2xl font-semibold">
                        {o.discount_pct}%
                      </p>
                      <p className="text-xs text-muted-foreground">off</p>
                    </div>
                  </div>
                  {o.min_check_cents > 0 ? (
                    <p className="text-xs text-muted-foreground pt-2 border-t mt-3">
                      Min spend {centsToUsd(o.min_check_cents)}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
