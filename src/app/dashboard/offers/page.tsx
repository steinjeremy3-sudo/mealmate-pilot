// Merchant: list of all my offers, any status.

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { buttonVariants, Card, Eyebrow, Heading } from "@/components/brand";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { getOffersForMerchant, type OfferStatus } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const OFFER_BADGE: Record<OfferStatus, string> = {
  draft: "border-border bg-cream-warm text-muted-foreground",
  scheduled: "border-amber/50 bg-amber/15 text-ink/80",
  live: "border-sage/40 bg-sage-tint text-sage",
  ended: "border-border bg-cream-warm text-muted-foreground",
};

function StatusBadge({ status }: { status: OfferStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        OFFER_BADGE[status],
      )}
    >
      {status}
    </span>
  );
}

export default async function MerchantOffersPage() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const offers = await getOffersForMerchant();

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Eyebrow>{restaurant.name}</Eyebrow>
            <Heading as="h1" size="page">
              Offers
            </Heading>
          </div>
          {restaurant.status === "approved" ? (
            <Link
              href="/dashboard/offers/new"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              New offer
            </Link>
          ) : (
            <p className="max-w-[200px] text-right text-xs text-muted-foreground">
              You can create offers once your restaurant is approved.
            </p>
          )}
        </div>

        {offers.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No offers yet. Create one to start filling tables.
          </Card>
        ) : (
          <Card flush className="divide-y divide-border overflow-hidden">
            {offers.map((o) => (
              <Link
                key={o.id}
                href={`/dashboard/offers/${o.id}`}
                className="flex items-start justify-between gap-4 p-4 transition-colors hover:bg-cream-warm"
              >
                <div className="space-y-1">
                  <p className="font-medium">{o.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {o.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.discount_pct}% off · min spend{" "}
                    {centsToUsd(o.min_check_cents)}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
