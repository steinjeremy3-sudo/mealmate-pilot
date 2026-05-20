// Diner home — browse live offers, restaurant-first, with cuisine
// filter chips.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getDinerRebateBannerSummary } from "@/lib/db/diner-rebate-status";
import { getLiveOffers } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

import { OfferBrowse } from "./OfferBrowse";
import type { OfferCardData } from "./OfferCard";

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
        <div className="space-y-1.5">
          <Eyebrow>
            Meal<span className="text-orange">Mate</span> · Live in Dallas
          </Eyebrow>
          <Heading as="h1" size="display">
            {offers.length === 0 ? (
              "No offers right now"
            ) : (
              <>
                Tonight&apos;s <em>tables</em>
              </>
            )}
          </Heading>
        </div>

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

        {offers.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            Check back soon. New offers appear here as restaurants publish
            them.
          </Card>
        ) : (
          <OfferBrowse offers={offers as OfferCardData[]} />
        )}
      </div>
    </main>
  );
}
