// Merchant: create a new offer.
//
// All offers start as `draft`. The merchant publishes from the offer
// detail page once it looks right.

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { getStripeAccountForRestaurant } from "@/lib/db/stripe-accounts";

import { PageHeader } from "@/components/console/PageHeader";
import { OfferForm } from "./OfferForm";

type SearchParams = Promise<{ error?: string }>;

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);

  if (!restaurant) {
    redirect("/dashboard/onboarding");
  }
  if (restaurant.status !== "approved") {
    redirect("/dashboard?error=approval-required");
  }

  const stripeAccount = await getStripeAccountForRestaurant(restaurant.id);
  if (!stripeAccount || stripeAccount.status !== "active") {
    redirect("/dashboard?error=stripe-not-active");
  }

  const { error } = await searchParams;

  return (
    <>
      <PageHeader
        eyebrow="Offers · new"
        title={
          <>
            A new window
          </>
        }
        sub="The form on the left; a live diner preview on the right"
      />
      <div className="px-10 py-8">
        <OfferForm
          restaurantName={restaurant.name}
          cuisine={restaurant.cuisine}
          neighborhood={restaurant.neighborhood}
          error={error}
        />
      </div>
    </>
  );
}
