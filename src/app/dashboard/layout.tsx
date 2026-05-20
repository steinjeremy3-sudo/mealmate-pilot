// Merchant section layout (/dashboard).
//
// Phase 1: enforces role=merchant. Unauthenticated → /sign-in.
// Wrong role → bounced to their own home (see requireRole).
//
// Visual reference: design-reference/merchant.html — a desktop
// dashboard with a dark ink sidebar.

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
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-cream-soft px-6 py-3">
          <SignOutButton />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
