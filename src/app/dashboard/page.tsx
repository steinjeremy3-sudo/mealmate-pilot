// Merchant dashboard home. Shows the merchant's restaurant + status.
// If no restaurant yet, redirects to the onboarding flow.

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import {
  Button,
  buttonVariants,
  Card,
  Eyebrow,
  Heading,
} from "@/components/brand";
import { getRestaurantForOwner, type RestaurantStatus } from "@/lib/db/restaurants";
import {
  getStripeAccountForRestaurant,
  type StripeAccountStatus,
} from "@/lib/db/stripe-accounts";
import { cn } from "@/lib/utils";

import {
  refreshStripeAccountStatus,
  startStripeOnboarding,
} from "./onboarding/stripe/actions";

type BadgeTone = "positive" | "warning" | "negative";

const toneClasses: Record<BadgeTone, string> = {
  positive: "border-sage/40 bg-sage-tint text-sage",
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

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Eyebrow>Your restaurant</Eyebrow>

        <Card className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Heading as="h1" size="page">
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
              The MealMate team typically approves new restaurants within a
              business day. You&apos;ll be able to set up payouts and create
              offers once approved.
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

        {/* ===== Stripe Connect ===== */}
        {restaurant.status === "approved" ? (
          <Card className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Eyebrow>Payouts via Stripe</Eyebrow>
                <Heading size="section">
                  {stripeAccount?.status === "active"
                    ? "You're set up"
                    : stripeAccount
                      ? "Finish setup"
                      : "Set up payouts"}
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
                  We collect bank details and KYC through Stripe so MealMate
                  can settle the weekly discount invoice with you. Takes
                  about 5 minutes.
                </p>
                <form action={startStripeOnboarding}>
                  <Button type="submit">Continue on Stripe →</Button>
                </form>
              </>
            ) : stripeAccount.status === "active" ? (
              <p className="text-sm text-muted-foreground">
                Your Stripe Connect account is verified. Weekly settlement
                invoices will be pulled from the bank account you
                registered.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Stripe is reviewing the information you submitted. If you
                  need to update it, continue on Stripe.
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

        {/* ===== Manage offers (gated on payouts_enabled) ===== */}
        {restaurant.status === "approved" ? (
          <Card className="space-y-3 p-6">
            <Eyebrow>Offers</Eyebrow>
            {canCreateOffers ? (
              <Link
                href="/dashboard/offers"
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                Manage offers →
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can create offers once your Stripe Connect account is
                verified above.
              </p>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
