// Admin: review a single restaurant. Phase 2a only supports Approve —
// Reject / Suspend come later (need somewhere to record the reason).

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
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
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground transition-colors hover:text-orange"
        >
          ← Back to queue
        </Link>

        <Card className="space-y-4 p-6">
          <div className="space-y-1">
            <Eyebrow>Restaurant · {restaurant.status}</Eyebrow>
            <Heading as="h1" size="page">
              {restaurant.name}
            </Heading>
            <p className="text-sm text-muted-foreground">
              {restaurant.cuisine} · {restaurant.neighborhood},{" "}
              {restaurant.city}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
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
            <form action={approveRestaurant} className="pt-1">
              <input
                type="hidden"
                name="restaurant_id"
                value={restaurant.id}
              />
              <Button type="submit">Approve</Button>
            </form>
          ) : (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              Already {restaurant.status}.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
