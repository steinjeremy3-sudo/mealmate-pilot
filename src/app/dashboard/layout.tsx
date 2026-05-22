// Merchant section layout (/dashboard).
//
// Phase 1: enforces role=merchant. Unauthenticated → /sign-in.
// Wrong role → bounced to their own home (see requireRole).
//
// Desktop dashboard with the bundle's warm cream sidebar; each page
// renders its own MerchantPageHeader.

import { requireRole } from "@/lib/auth/require-role";
import { SignOutButton } from "@/components/sign-out-button";
import { getRestaurantForOwner } from "@/lib/db/restaurants";

import { DashboardSidebar } from "./DashboardSidebar";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);

  return (
    <div className="flex flex-1 bg-background">
      <DashboardSidebar
        restaurantName={restaurant?.name ?? null}
        displayName={profile.displayName}
        footerSlot={<SignOutButton className="w-full" />}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
