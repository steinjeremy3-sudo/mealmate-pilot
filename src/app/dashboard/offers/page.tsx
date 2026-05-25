// Merchant: list of all my offers, any status — a desktop table.

import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants, Card } from "@/components/brand";
import { requireRole } from "@/lib/auth/require-role";
import { getOffersForMerchant, type OfferStatus } from "@/lib/db/offers";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { centsToUsd } from "@/lib/money";
import { formatDayRange, formatTimeRange } from "@/lib/offers/format";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/console/PageHeader";

const OFFER_BADGE: Record<OfferStatus, string> = {
  draft: "border-border bg-bone-deep text-muted-foreground",
  scheduled: "border-paprika/50 bg-paprika/15 text-ink/80",
  live: "border-ink/15 bg-bone-deep text-ink",
  ended: "border-border bg-bone-deep text-muted-foreground",
};

function StatusBadge({ status }: { status: OfferStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]",
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
    <>
      <PageHeader
        eyebrow={restaurant.name}
        title={
          <>
            Offers you&apos;re <em>running.</em>
          </>
        }
        sub="Each offer is a daypart window with a discount diners can activate."
        actions={
          restaurant.status === "approved" ? (
            <Link
              href="/dashboard/offers/new"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              Create offer
            </Link>
          ) : (
            <span className="max-w-[200px] text-right text-xs text-muted-foreground">
              You can create offers once your restaurant is approved.
            </span>
          )
        }
      />

      <div className="px-10 py-8">
        {offers.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No offers yet. Create one to start filling tables.
          </Card>
        ) : (
          <Card flush className="overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-4 border-b border-border px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              <span className="flex-1">Name</span>
              <span className="w-20 text-right">Discount</span>
              <span className="w-44">Window</span>
              <span className="w-40">Budget</span>
              <span className="w-24">Status</span>
            </div>
            {offers.map((o) => (
              <Link
                key={o.id}
                href={`/dashboard/offers/${o.id}`}
                className="flex items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-bone-deep"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.description}
                  </p>
                </div>
                <span className="w-20 text-right font-mono text-sm">
                  {o.discount_pct}%
                </span>
                <span className="w-44 font-mono text-xs text-muted-foreground">
                  {formatDayRange(o.valid_days)}
                  <br />
                  {formatTimeRange(o.valid_start_time, o.valid_end_time)}
                </span>
                <span className="w-40">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full rounded-full bg-paprika"
                      style={{
                        width: `${
                          o.monthly_budget_cents > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (o.monthly_spent_cents /
                                    o.monthly_budget_cents) *
                                    100,
                                ),
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                    {centsToUsd(o.monthly_spent_cents)} /{" "}
                    {centsToUsd(o.monthly_budget_cents)}
                  </span>
                </span>
                <span className="w-24">
                  <StatusBadge status={o.status} />
                </span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
