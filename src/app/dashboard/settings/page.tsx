// Merchant settings — restaurant profile + payout (Stripe Connect)
// status. Restaurant details are read-only here: changes affect
// transaction matching and approval, so they route through ops.

import Link from "next/link";
import { redirect } from "next/navigation";

import { Button, Card, Eyebrow } from "@/components/brand";
import { requireRole } from "@/lib/auth/require-role";
import {
  getRestaurantForOwner,
  type RestaurantStatus,
} from "@/lib/db/restaurants";
import {
  getStripeAccountForRestaurant,
  type StripeAccountStatus,
} from "@/lib/db/stripe-accounts";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/console/PageHeader";
import {
  refreshStripeAccountStatus,
  startStripeOnboarding,
} from "../onboarding/stripe/actions";

type BadgeTone = "positive" | "warning" | "negative";

const toneClasses: Record<BadgeTone, string> = {
  positive: "border-ink/15 bg-bone-deep text-ink",
  warning: "border-paprika/50 bg-paprika/15 text-ink/80",
  negative: "border-destructive/40 bg-burnt/15 text-destructive",
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

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-border py-3 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export default async function MerchantSettingsPage() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  let stripeAccount =
    restaurant.status === "approved"
      ? await getStripeAccountForRestaurant(restaurant.id)
      : null;

  // Self-heal a stale mirror if a webhook was missed.
  if (stripeAccount && stripeAccount.status !== "active") {
    await refreshStripeAccountStatus(
      stripeAccount.restaurant_id,
      stripeAccount.stripe_account_id,
    );
    stripeAccount = await getStripeAccountForRestaurant(restaurant.id);
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title={
          <>
            Your <em>account.</em>
          </>
        }
        sub="Restaurant profile and how Mealmate settles with you."
      />

      <div className="px-10 py-8">
        <div className="grid w-full max-w-3xl gap-6 md:grid-cols-2">
          {/* Restaurant profile */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl tracking-tight">
                Restaurant
              </h2>
              <Badge tone={RESTAURANT_BADGE[restaurant.status].tone}>
                {RESTAURANT_BADGE[restaurant.status].label}
              </Badge>
            </div>
            <dl className="mt-3 border-t border-border">
              <Fact k="Name" v={restaurant.name} />
              <Fact k="Cuisine" v={restaurant.cuisine} />
              <Fact k="Neighborhood" v={restaurant.neighborhood} />
              <Fact k="City" v={restaurant.city} />
              <Fact k="Address" v={restaurant.address} />
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Restaurant details affect how visits are confirmed, so
              changes go through the Mealmate team. Email{" "}
              <Link
                href="mailto:ops@mealmate.co"
                className="text-paprika underline underline-offset-4"
              >
                ops@mealmate.co
              </Link>{" "}
              to update them.
            </p>
          </Card>

          {/* Payouts */}
          <Card className="flex flex-col p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Eyebrow>Payouts</Eyebrow>
                <h2 className="font-display text-xl tracking-tight">
                  Stripe Connect
                </h2>
              </div>
              {stripeAccount ? (
                <Badge tone={STRIPE_BADGE[stripeAccount.status].tone}>
                  {STRIPE_BADGE[stripeAccount.status].label}
                </Badge>
              ) : null}
            </div>

            {restaurant.status !== "approved" ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Payout setup unlocks once your restaurant is approved.
              </p>
            ) : !stripeAccount ? (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  Connect a Stripe account so Mealmate can settle the
                  weekly discount invoice with you.
                </p>
                <form action={startStripeOnboarding} className="mt-auto pt-5">
                  <Button type="submit">Set up payouts →</Button>
                </form>
              </>
            ) : (
              <>
                <dl className="mt-3 border-t border-border">
                  <Fact
                    k="Account"
                    v={
                      <span className="font-mono text-xs">
                        {stripeAccount.stripe_account_id}
                      </span>
                    }
                  />
                  <Fact
                    k="Details submitted"
                    v={stripeAccount.details_submitted ? "Yes" : "No"}
                  />
                  <Fact
                    k="Charges enabled"
                    v={stripeAccount.charges_enabled ? "Yes" : "No"}
                  />
                  <Fact
                    k="Payouts enabled"
                    v={stripeAccount.payouts_enabled ? "Yes" : "No"}
                  />
                </dl>
                <form action={startStripeOnboarding} className="mt-auto pt-5">
                  <Button type="submit" variant="ghost">
                    Manage on Stripe →
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
