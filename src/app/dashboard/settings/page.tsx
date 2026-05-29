// Merchant settings — restaurant profile + payout (Stripe Connect)
// status. Restaurant details are read-only here: changes affect
// transaction matching and approval, so they route through ops.

import Link from "next/link";
import { redirect } from "next/navigation";

import { Button, Card, Eyebrow, PlaceholderImg } from "@/components/brand";
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
import { removeRestaurantPhoto, uploadRestaurantPhoto } from "./actions";

type SearchParams = Promise<{ error?: string; photo?: string }>;

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

export default async function MerchantSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const { error: photoError } = await searchParams;

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
            Your account
          </>
        }
        sub="Restaurant profile and how Mealmate settles with you"
      />

      <div className="px-10 py-8">
        {/* Hero photo + upload */}
        <div className="mb-6 max-w-3xl">
          <PlaceholderImg
            name={restaurant.name}
            src={restaurant.photo_url}
            caption={`${restaurant.cuisine} · ${restaurant.neighborhood}`}
            showName
            className="h-44 rounded-2xl"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <form action={uploadRestaurantPhoto} className="flex items-center gap-2">
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                required
                className="text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-bone file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-bone-deep"
              />
              <Button type="submit" variant="ghost" size="sm">
                {restaurant.photo_url ? "Replace photo" : "Upload photo"}
              </Button>
            </form>
            {restaurant.photo_url ? (
              <form action={removeRestaurantPhoto}>
                <button
                  type="submit"
                  className="cursor-pointer text-xs text-muted-foreground underline underline-offset-4 hover:text-destructive"
                >
                  Remove
                </button>
              </form>
            ) : null}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            JPG, PNG, or WebP · up to 5 MB. Shown to diners on your offers.
          </p>
          {photoError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {photoError}
            </p>
          ) : null}
        </div>
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
                href="mailto:support@mealmatedining.com"
                className="text-paprika underline underline-offset-4"
              >
                support@mealmatedining.com
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
