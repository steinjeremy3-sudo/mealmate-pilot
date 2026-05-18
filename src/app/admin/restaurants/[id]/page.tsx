// Admin: review a single restaurant. Phase 2a only supports Approve —
// Reject / Suspend come later (need somewhere to record the reason).

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantById } from "@/lib/db/restaurants";

import { approveRestaurant } from "./actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function AdminRestaurantReview({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole("admin");

  const { id } = await params;
  const { error } = await searchParams;
  const restaurant = await getRestaurantById(id);
  if (!restaurant) {
    notFound();
  }

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <Link href="/admin" className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back to queue
        </Link>

        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Restaurant · {restaurant.status}
            </p>
            <h1 className="font-serif text-3xl font-semibold">
              {restaurant.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {restaurant.cuisine} · {restaurant.neighborhood}, {restaurant.city}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-2 border-t">
            <dt className="text-muted-foreground">Address</dt>
            <dd>{restaurant.address}</dd>

            <dt className="text-muted-foreground">MCC</dt>
            <dd>{restaurant.mcc}</dd>

            <dt className="text-muted-foreground">Owner</dt>
            <dd>{restaurant.owner?.display_name ?? "—"}</dd>

            <dt className="text-muted-foreground">Owner email</dt>
            <dd className="break-all">{restaurant.owner?.email ?? "—"}</dd>

            <dt className="text-muted-foreground">Submitted</dt>
            <dd>{new Date(restaurant.created_at).toLocaleString()}</dd>
          </dl>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {restaurant.status === "pending" ? (
            <form action={approveRestaurant} className="pt-2">
              <input type="hidden" name="restaurant_id" value={restaurant.id} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Approve
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground pt-2 border-t">
              Already {restaurant.status}.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
