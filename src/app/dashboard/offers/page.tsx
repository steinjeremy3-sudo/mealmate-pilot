// Merchant: offers grouped into Active (recurring + limited-time) and
// Archived (ended or past their end date), so the list doesn't clutter
// up over time.

import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants, Card } from "@/components/brand";
import { requireRole } from "@/lib/auth/require-role";
import { getOffersForMerchant, type OfferWithRestaurant } from "@/lib/db/offers";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { offerDisplayStatus } from "@/lib/offers/availability";
import { formatDayRange, formatTimeRange } from "@/lib/offers/format";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/console/PageHeader";

const BADGE: Record<string, string> = {
  draft: "border-border bg-bone-deep text-muted-foreground",
  scheduled: "border-paprika/50 bg-paprika/15 text-ink/80",
  live: "border-ink/15 bg-bone-deep text-ink",
  ended: "border-border bg-bone-deep text-muted-foreground",
  expired: "border-border bg-bone-deep text-muted-foreground",
};

function isExpired(o: OfferWithRestaurant): boolean {
  return o.ends_at != null && new Date(o.ends_at).getTime() < Date.now();
}
function isArchived(o: OfferWithRestaurant): boolean {
  return o.status === "ended" || isExpired(o);
}
function isRecurring(o: OfferWithRestaurant): boolean {
  return o.ends_at == null;
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]",
        BADGE[label] ?? BADGE.ended,
      )}
    >
      {label}
    </span>
  );
}

function OfferRow({ o }: { o: OfferWithRestaurant }) {
  return (
    <Link
      href={`/dashboard/offers/${o.id}`}
      className="flex items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-bone-deep"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base">{o.title}</p>
        <p className="truncate text-xs text-muted-foreground">{o.description}</p>
      </div>
      <span className="w-20 text-right font-mono text-sm">{o.discount_pct}%</span>
      <span className="w-44 font-mono text-xs text-muted-foreground">
        {formatDayRange(o.valid_days)}
        <br />
        {formatTimeRange(o.valid_start_time, o.valid_end_time)}
        {o.ends_at ? (
          <>
            <br />
            <span className="text-[10px]">
              ends {new Date(o.ends_at).toLocaleDateString()}
            </span>
          </>
        ) : null}
      </span>
      <span className="w-28 font-mono text-xs text-muted-foreground">
        {o.max_claims_total != null
          ? `${o.max_claims_total} cap`
          : "No cap"}
      </span>
      <span className="w-24">
        <StatusBadge label={offerDisplayStatus(o)} />
      </span>
    </Link>
  );
}

function Section({
  title,
  hint,
  offers,
  muted,
}: {
  title: string;
  hint: string;
  offers: OfferWithRestaurant[];
  muted?: boolean;
}) {
  if (offers.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2
          className={cn(
            "font-display text-lg tracking-tight",
            muted && "text-muted-foreground",
          )}
        >
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Card flush className={cn("overflow-hidden", muted && "opacity-90")}>
        <div className="flex items-center gap-4 border-b border-border px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          <span className="flex-1">Name</span>
          <span className="w-20 text-right">Discount</span>
          <span className="w-44">Window</span>
          <span className="w-28">Cap</span>
          <span className="w-24">Status</span>
        </div>
        {offers.map((o) => (
          <OfferRow key={o.id} o={o} />
        ))}
      </Card>
    </section>
  );
}

export default async function MerchantOffersPage() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const offers = await getOffersForMerchant();

  const active = offers.filter((o) => !isArchived(o));
  const archived = offers.filter(isArchived);
  const recurringActive = active.filter(isRecurring);
  const limitedActive = active.filter((o) => !isRecurring(o));

  return (
    <>
      <PageHeader
        eyebrow={restaurant.name}
        title={<>Offers you&apos;re running</>}
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

      <div className="space-y-10 px-10 py-8">
        {offers.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No offers yet. Create one to start filling tables.
          </Card>
        ) : (
          <>
            <Section
              title="Recurring"
              hint="Run every selected day, indefinitely."
              offers={recurringActive}
            />
            <Section
              title="Limited-time"
              hint="Run until their end date, then move to Archived."
              offers={limitedActive}
            />
            <Section
              title="Archived"
              hint="Ended or past their end date. Kept for your records."
              offers={archived}
              muted
            />
            {active.length === 0 ? (
              <Card className="border-dashed text-center text-sm text-muted-foreground">
                No active offers. Create one to start filling tables again.
              </Card>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
