// Admin: review a single restaurant. Phase 2a only supports Approve —
// Reject / Suspend come later (need somewhere to record the reason).

import Link from "next/link";
import { notFound } from "next/navigation";

import { Button, Card } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import { getRestaurantById } from "@/lib/db/restaurants";
import { cn } from "@/lib/utils";

import { approveRestaurant } from "./actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

const STATUS_TONE: Record<string, string> = {
  approved: "border-sage/40 bg-sage-tint text-sage",
  pending: "border-amber/50 bg-amber/15 text-ink/80",
  suspended: "border-destructive/40 bg-rose/15 text-destructive",
};

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-border py-3 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

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
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="transition-colors hover:text-orange">
            ← Control room
          </Link>
        }
        title={restaurant.name}
        sub={`${restaurant.cuisine} · ${restaurant.neighborhood}, ${restaurant.city}`}
        actions={
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.06em]",
              STATUS_TONE[restaurant.status] ?? STATUS_TONE.pending,
            )}
          >
            {restaurant.status}
          </span>
        }
      />

      <div className="px-10 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <Card className="p-6">
            <h2 className="font-serif text-xl tracking-tight">
              Submitted info
            </h2>
            <dl className="mt-3 border-t border-border">
              <Fact k="Address" v={restaurant.address} />
              <Fact k="MCC" v={restaurant.mcc} />
              <Fact k="Owner" v={restaurant.owner?.display_name ?? "—"} />
              <Fact
                k="Owner email"
                v={
                  <span className="break-all">
                    {restaurant.owner?.email ?? "—"}
                  </span>
                }
              />
              <Fact
                k="Submitted"
                v={new Date(restaurant.created_at).toLocaleString()}
              />
            </dl>
          </Card>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {restaurant.status === "pending" ? (
            <Card className="space-y-3 p-6">
              <p className="text-sm text-muted-foreground">
                Approving lets this restaurant set up Stripe payouts and
                publish offers to diners.
              </p>
              <form action={approveRestaurant}>
                <input
                  type="hidden"
                  name="restaurant_id"
                  value={restaurant.id}
                />
                <Button type="submit">Approve &amp; onboard</Button>
              </form>
            </Card>
          ) : (
            <Card className="text-sm text-muted-foreground">
              Already {restaurant.status}.
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
