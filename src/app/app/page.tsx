// Diner home — browse live offers from approved restaurants.
// Tapping an offer opens the detail page.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
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
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {showRebateSetupBanner ? (
          <Link href="/app/rebates/setup" className="block">
            <Card className="border-orange/30 bg-orange-tint transition-colors hover:bg-orange-soft/30">
              <p className="font-medium text-ink">
                You have {centsToUsd(rebateBanner.initiatedCents)} in rebates
                waiting.
              </p>
              <p className="mt-1 text-sm text-orange-deep">
                Pick a checking account to receive them →
              </p>
            </Card>
          </Link>
        ) : null}

        <div className="space-y-1.5">
          <Eyebrow>Live offers in Dallas</Eyebrow>
          <Heading as="h1" size="display">
            {offers.length === 0 ? (
              "No offers right now"
            ) : (
              <>
                <em>{offers.length}</em> live
              </>
            )}
          </Heading>
        </div>

        {offers.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            Check back soon. New offers appear here as restaurants publish
            them.
          </Card>
        ) : (
          <ul className="space-y-3">
            {offers.map((o) => (
              <li key={o.id}>
                <Link href={`/app/offers/${o.id}`} className="block">
                  <Card className="transition-colors hover:bg-cream-warm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-serif text-lg font-medium tracking-tight">
                          {o.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.restaurant?.name ?? "—"} ·{" "}
                          {o.restaurant?.neighborhood ?? "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-serif text-3xl font-medium leading-none text-orange">
                          {o.discount_pct}%
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          off
                        </p>
                      </div>
                    </div>
                    {o.min_check_cents > 0 ? (
                      <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                        Min spend {centsToUsd(o.min_check_cents)}
                      </p>
                    ) : null}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
