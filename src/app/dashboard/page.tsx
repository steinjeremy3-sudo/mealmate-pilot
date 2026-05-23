// Merchant dashboard home.
//
//   - No restaurant            → redirect to onboarding
//   - Restaurant not yet live  → onboarding view (status + Stripe setup)
//   - Restaurant live          → metrics dashboard (KPIs, recent
//                                matches, settlement preview)

import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Button,
  buttonVariants,
  Card,
  Eyebrow,
  Heading,
} from "@/components/brand";
import { requireRole } from "@/lib/auth/require-role";
import {
  getRecentMatchedTransactionsForMerchant,
  getSettlementsForMerchant,
} from "@/lib/db/merchant-settlements";
import { getOffersForMerchant } from "@/lib/db/offers";
import { getRestaurantForOwner, type RestaurantStatus } from "@/lib/db/restaurants";
import {
  getStripeAccountForRestaurant,
  type StripeAccountStatus,
} from "@/lib/db/stripe-accounts";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/console/PageHeader";
import { KpiCard } from "@/components/console/KpiCard";
import {
  refreshStripeAccountStatus,
  startStripeOnboarding,
} from "./onboarding/stripe/actions";

type BadgeTone = "positive" | "warning" | "negative";

const toneClasses: Record<BadgeTone, string> = {
  positive: "border-ink/15 bg-cream-warm text-ink",
  warning: "border-amber/50 bg-amber/15 text-ink/80",
  negative: "border-destructive/40 bg-rose/15 text-destructive",
};

function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

const RESTAURANT_BADGE: Record<RestaurantStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: "warning", label: "Pending approval" },
  approved: { tone: "positive", label: "Approved" },
  suspended: { tone: "negative", label: "Suspended" },
};

const STRIPE_BADGE: Record<StripeAccountStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: "warning", label: "Setup in progress" },
  restricted: { tone: "warning", label: "Stripe review" },
  active: { tone: "positive", label: "Connected" },
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function MerchantHome() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);

  if (!restaurant) {
    redirect("/dashboard/onboarding");
  }

  let stripeAccount =
    restaurant.status === "approved"
      ? await getStripeAccountForRestaurant(restaurant.id)
      : null;

  // Self-heal stale mirrors: if a webhook delivery was missed, pull
  // fresh state directly from Stripe.
  if (stripeAccount && stripeAccount.status !== "active") {
    await refreshStripeAccountStatus(
      stripeAccount.restaurant_id,
      stripeAccount.stripe_account_id,
    );
    stripeAccount = await getStripeAccountForRestaurant(restaurant.id);
  }

  const canCreateOffers =
    restaurant.status === "approved" && stripeAccount?.status === "active";
  const firstName = profile.displayName?.trim().split(/\s+/)[0] || "there";

  // ====================================================================
  // Onboarding view — restaurant pending, or payouts not yet set up.
  // ====================================================================
  if (!canCreateOffers) {
    return (
      <>
        <PageHeader
          eyebrow="Your restaurant"
          title={
            <>
              Welcome, <em>{firstName}.</em>
            </>
          }
          sub="A couple of steps before your offers can go live."
        />
        <div className="px-10 py-8">
          <div className="w-full max-w-2xl space-y-5">
            <Card className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Heading as="h2" size="section">
                    {restaurant.name}
                  </Heading>
                  <p className="text-sm text-muted-foreground">
                    {restaurant.cuisine} · {restaurant.neighborhood},{" "}
                    {restaurant.city}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {restaurant.address}
                  </p>
                </div>
                <Badge tone={RESTAURANT_BADGE[restaurant.status].tone}>
                  {RESTAURANT_BADGE[restaurant.status].label}
                </Badge>
              </div>

              {restaurant.status === "pending" ? (
                <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                  The MealMate team typically approves new restaurants
                  within a business day. You&apos;ll be able to set up
                  payouts and create offers once approved.
                </p>
              ) : null}

              {restaurant.status === "suspended" ? (
                <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                  Your restaurant is currently suspended. Reach out to{" "}
                  <Link
                    href="mailto:ops@mealmate.co"
                    className="text-orange underline underline-offset-4"
                  >
                    ops@mealmate.co
                  </Link>{" "}
                  for help.
                </p>
              ) : null}
            </Card>

            {restaurant.status === "approved" ? (
              <Card className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Eyebrow>Payouts via Stripe</Eyebrow>
                    <Heading size="section">
                      {stripeAccount ? "Finish setup" : "Set up payouts"}
                    </Heading>
                  </div>
                  {stripeAccount ? (
                    <Badge tone={STRIPE_BADGE[stripeAccount.status].tone}>
                      {STRIPE_BADGE[stripeAccount.status].label}
                    </Badge>
                  ) : null}
                </div>

                {!stripeAccount ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      We collect bank details and KYC through Stripe so
                      MealMate can settle the weekly discount invoice with
                      you. Takes about 5 minutes.
                    </p>
                    <form action={startStripeOnboarding}>
                      <Button type="submit">Continue on Stripe →</Button>
                    </form>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Stripe is reviewing the information you submitted. If
                      you need to update it, continue on Stripe.
                    </p>
                    <form action={startStripeOnboarding}>
                      <Button type="submit" variant="ghost">
                        Continue on Stripe →
                      </Button>
                    </form>
                  </>
                )}
              </Card>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  // ====================================================================
  // Metrics dashboard — restaurant live.
  // ====================================================================
  const [offers, matches, settlements] = await Promise.all([
    getOffersForMerchant(),
    getRecentMatchedTransactionsForMerchant(25),
    getSettlementsForMerchant(),
  ]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMatches = matches.filter((m) => new Date(m.transactionDate) >= weekAgo);

  const activeOffers = offers.filter((o) => o.status === "live").length;
  const weekCheckCents = weekMatches.reduce((s, m) => s + m.amountCents, 0);
  const avgCheckCents = weekMatches.length
    ? Math.round(weekCheckCents / weekMatches.length)
    : 0;
  const weekDiscountCents = weekMatches.reduce(
    (s, m) => s + (m.discountCents ?? 0),
    0,
  );

  const pendingSettlement =
    settlements.find((s) => s.status === "pending") ?? settlements[0] ?? null;
  const recentMatches = matches.slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow="This week"
        title={
          <>
            Evening, <em>{firstName}.</em>
          </>
        }
        sub={`Here's how ${restaurant.name} is tracking against this week's offers.`}
        actions={
          <Link
            href="/dashboard/offers/new"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            Create offer
          </Link>
        }
      />

      <div className="space-y-8 px-10 py-8">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active offers" value={String(activeOffers)} />
          <KpiCard
            label="Visits this week"
            value={String(weekMatches.length)}
          />
          <KpiCard
            label="Avg check"
            value={avgCheckCents ? centsToUsd(avgCheckCents) : "—"}
          />
          <KpiCard
            label="Discount given · wk"
            value={centsToUsd(weekDiscountCents)}
          />
        </div>

        {/* Matches + settlement */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-2">
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div>
                <h2 className="font-serif text-xl tracking-tight">
                  Recent visits
                </h2>
                <p className="text-xs text-muted-foreground">
                  Diners who used your offers. Settles weekly.
                </p>
              </div>
              <Link
                href="/dashboard/settlements"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                See all
              </Link>
            </div>
            {recentMatches.length === 0 ? (
              <p className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
                No visits yet. They appear here 1–2 days after a diner
                pays.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border">
                    {["When", "Diner", "Offer", "Check", "Discount"].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={cn(
                            "px-6 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground",
                            i >= 3 ? "text-right" : "text-left",
                          )}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {recentMatches.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-6 py-4 font-mono text-[13px] text-muted-foreground">
                        {shortDate(m.transactionDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex size-7 items-center justify-center rounded-full bg-cream-warm font-mono text-[11px]">
                          {m.dinerInitials ?? "·"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {m.offerTitle ?? m.merchantNameRaw}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[13px]">
                        {centsToUsd(m.amountCents)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[13px] text-orange-deep">
                        {m.discountCents != null
                          ? `−${centsToUsd(m.discountCents)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Card className="flex flex-col p-6">
            <Eyebrow tone="muted">Next invoice</Eyebrow>
            {pendingSettlement ? (
              <>
                <p className="pb-2 pt-3 font-serif text-4xl leading-none tracking-tight">
                  {centsToUsd(pendingSettlement.totalDiscountCents)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pendingSettlement.transactionCount} visit
                  {pendingSettlement.transactionCount === 1 ? "" : "s"} ·{" "}
                  {shortDate(pendingSettlement.periodStart)}–
                  {shortDate(pendingSettlement.periodEnd)}
                </p>
                <Link
                  href={`/dashboard/settlements/${pendingSettlement.id}`}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "md",
                    className: "mt-5 w-full",
                  })}
                >
                  Preview invoice
                </Link>
              </>
            ) : (
              <p className="pt-3 text-sm text-muted-foreground">
                No invoice due right now. Visits roll up into a weekly
                invoice, settled via Stripe.
              </p>
            )}
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["Create offer", "Add a new daypart or window.", "/dashboard/offers/new"],
              ["Tonight", "Offers diners are holding right now.", "/dashboard/claims"],
              ["Settlements", "Weekly invoices and history.", "/dashboard/settlements"],
            ] as const
          ).map(([label, sub, href]) => (
            <Link key={href} href={href}>
              <Card className="h-full space-y-1.5 p-5 transition-colors hover:bg-cream-warm">
                <Eyebrow>Quick action</Eyebrow>
                <p className="pt-1 font-serif text-xl tracking-tight">
                  {label}
                </p>
                <p className="text-sm text-muted-foreground">{sub}</p>
                <p className="pt-2 text-sm font-medium text-orange">Open →</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
