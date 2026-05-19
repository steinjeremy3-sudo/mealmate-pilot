// Merchant: list of all my offers, any status.
//
// Empty state nudges them to create their first one.

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { getOffersForMerchant, type OfferStatus } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

function StatusBadge({ status }: { status: OfferStatus }) {
  const styles: Record<OfferStatus, string> = {
    draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
    scheduled: "bg-blue-100 text-blue-900 border-blue-200",
    live: "bg-emerald-100 text-emerald-900 border-emerald-200",
    ended: "bg-neutral-100 text-neutral-500 border-neutral-200",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        styles[status]
      }
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
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              {restaurant.name}
            </p>
            <h1 className="font-serif text-3xl font-semibold">Offers</h1>
          </div>
          {restaurant.status === "approved" ? (
            <Link
              href="/dashboard/offers/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              New offer
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground max-w-[200px] text-right">
              You can create offers once your restaurant is approved.
            </p>
          )}
        </div>

        {offers.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            No offers yet. Create one to start filling tables.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {offers.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/dashboard/offers/${o.id}`}
                  className="flex items-start justify-between gap-4 p-4 hover:bg-secondary/40"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{o.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {o.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.discount_pct}% off · min spend{" "}
                      {centsToUsd(o.min_check_cents)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
