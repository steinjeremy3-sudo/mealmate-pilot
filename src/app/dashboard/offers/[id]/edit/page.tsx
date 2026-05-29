// Merchant: edit an existing offer. Reuses the create OfferForm,
// prefilled, submitting to updateOffer. Archived (ended/expired) offers
// aren't editable — we bounce back to the detail page.

import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getOfferById } from "@/lib/db/offers";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { offerDisplayStatus } from "@/lib/offers/availability";

import { PageHeader } from "@/components/console/PageHeader";
import { OfferForm } from "../../new/OfferForm";
import { updateOffer } from "../actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function EditOfferPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const { id } = await params;
  const { error } = await searchParams;

  const offer = await getOfferById(id);
  if (!offer || offer.restaurant_id !== restaurant.id) notFound();

  // Archived (ended or past its end date) offers aren't editable.
  const display = offerDisplayStatus(offer);
  if (display === "ended" || display === "expired") {
    redirect(`/dashboard/offers/${id}`);
  }

  return (
    <>
      <PageHeader
        eyebrow={`Editing · ${offer.title}`}
        title={<>Edit offer</>}
        sub="Update the window or terms; changes apply to new activations."
      />
      <div className="px-10 py-8">
        <OfferForm
          action={updateOffer}
          offerId={offer.id}
          restaurantName={restaurant.name}
          cuisine={restaurant.cuisine}
          neighborhood={restaurant.neighborhood}
          error={error}
          submitLabel="Save changes"
          submitHint="Changes apply to new activations right away."
          initial={{
            discount: offer.discount_pct,
            days: offer.valid_days,
            start: offer.valid_start_time.slice(0, 5),
            end: offer.valid_end_time.slice(0, 5),
            minCheck: Math.round(offer.min_check_cents / 100),
            maxRedemptions: offer.max_claims_total, // null = unlimited
            recurring: offer.ends_at == null,
          }}
        />
      </div>
    </>
  );
}
