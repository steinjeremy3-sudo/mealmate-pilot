// Diner search screen.

import { requireRole } from "@/lib/auth/require-role";
import { Eyebrow, Heading } from "@/components/brand";
import { getLiveOffers } from "@/lib/db/offers";

import type { OfferCardData } from "../OfferCard";
import { OfferSearch } from "./OfferSearch";

export default async function DinerSearchPage() {
  await requireRole("diner");
  const offers = await getLiveOffers();

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Search</Eyebrow>
          <Heading as="h1" size="page">
            Find a table
          </Heading>
        </div>
        <OfferSearch offers={offers as OfferCardData[]} />
      </div>
    </main>
  );
}
