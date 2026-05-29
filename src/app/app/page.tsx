// Diner home — a greeting, then editorial sections of live offers.

import Link from "next/link";
import { Bell } from "lucide-react";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow } from "@/components/brand";
import { getDinerRebateBannerSummary } from "@/lib/db/diner-rebate-status";
import { getLiveOffers } from "@/lib/db/offers";
import { getDinerCuisines } from "@/lib/db/diner-preferences";
import { getMyPlaidCards } from "@/lib/db/plaid-cards";
import { getRemainingByOffer } from "@/lib/db/offer-remaining";
import { getRebatesForDiner } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";

import { OfferBrowse } from "./OfferBrowse";
import type { OfferCardData } from "./OfferCard";
import { VisitBanner } from "./VisitBanner";

export default async function DinerHome() {
  const profile = await requireRole("diner");
  const [offers, rebateBanner, rebates, preferredCuisines, cards] =
    await Promise.all([
      getLiveOffers(),
      getDinerRebateBannerSummary(profile.id),
      getRebatesForDiner(profile.id),
      getDinerCuisines(profile.id),
      getMyPlaidCards(),
    ]);
  // "X left" urgency per offer (uncapped offers come back null → no badge).
  const remainingByOffer = await getRemainingByOffer(offers);
  const offerCards = offers.map((o) => ({
    ...o,
    remaining: remainingByOffer.get(o.id) ?? null,
  }));

  // A diner with no linked card can't earn anything yet — this is the
  // most fundamental onboarding nudge, so it outranks the other banners.
  const hasLinkedCard = cards.length > 0;
  const showRebateSetupBanner =
    !rebateBanner.hasDestination && rebateBanner.initiatedCents > 0;

  // Newest cash back from the last week, surfaced as a home banner.
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentRebate =
    rebates[0] && new Date(rebates[0].createdAt) >= weekAgo
      ? rebates[0]
      : null;

  const firstName =
    profile.displayName?.trim().split(/\s+/)[0] || "there";
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Greeting */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <Eyebrow>Dallas · {weekday}</Eyebrow>
            <p className="font-display text-[22px] leading-tight tracking-tight">
              Evening, {firstName}.
            </p>
          </div>
          <Link
            href="/app/wallet?show=pending"
            aria-label="Your cash back"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bone-deep text-ink transition-colors hover:bg-bone"
          >
            <Bell className="size-[18px]" strokeWidth={1.75} />
          </Link>
        </div>

        {!hasLinkedCard ? (
          <Link href="/app/cards" className="block">
            <Card className="border-paprika/30 bg-paprika-tint transition-colors hover:bg-paprika/30">
              <p className="font-medium text-ink">
                Link a card to start earning cash back.
              </p>
              <p className="mt-1 text-sm text-paprika-deep">
                We use read-only access to confirm your visits — we never
                charge it →
              </p>
            </Card>
          </Link>
        ) : showRebateSetupBanner ? (
          <Link href="/app/rebates/setup" className="block">
            <Card className="border-paprika/30 bg-paprika-tint transition-colors hover:bg-paprika/30">
              <p className="font-medium text-ink">
                You have {centsToUsd(rebateBanner.initiatedCents)} in cash
                back waiting.
              </p>
              <p className="mt-1 text-sm text-paprika-deep">
                Pick a checking account to receive them →
              </p>
            </Card>
          </Link>
        ) : recentRebate ? (
          <VisitBanner rebate={recentRebate} />
        ) : null}

        {offers.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            Check back soon. New offers appear here as restaurants publish
            them.
          </Card>
        ) : (
          <OfferBrowse
            offers={offerCards as OfferCardData[]}
            preferredCuisines={preferredCuisines}
          />
        )}
      </div>
    </main>
  );
}
