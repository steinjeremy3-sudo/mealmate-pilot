// Admin: every restaurant, filterable by status. Rows open the
// per-restaurant detail / approval page.

import Link from "next/link";

import { Card } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import {
  getAllRestaurants,
  type RestaurantStatus,
} from "@/lib/db/restaurants";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<RestaurantStatus, string> = {
  pending: "border-paprika/50 bg-paprika/15 text-ink/80",
  approved: "border-ink/15 bg-bone-deep text-ink",
  suspended: "border-destructive/40 bg-burnt/15 text-destructive",
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "suspended", label: "Suspended" },
];

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("admin");
  const { status } = await searchParams;
  const all = await getAllRestaurants();

  const counts: Record<string, number> = { all: all.length };
  for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const active =
    status && FILTERS.some((f) => f.key === status) ? status : "all";
  const shown =
    active === "all" ? all : all.filter((r) => r.status === active);

  return (
    <>
      <PageHeader
        eyebrow="Restaurants"
        title={
          <>
            Every partner, at a glance
          </>
        }
        sub="Filter by status. Open a row for the restaurant's full detail and approval."
      />

      <div className="space-y-5 px-10 py-8">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={
                f.key === "all"
                  ? "/admin/restaurants"
                  : `/admin/restaurants?status=${f.key}`
              }
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                active === f.key
                  ? "border-ink bg-ink text-bone"
                  : "border-border bg-transparent text-ink hover:bg-bone-deep",
              )}
            >
              {f.label}{" "}
              <span className="font-mono text-muted-foreground">
                {counts[f.key] ?? 0}
              </span>
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No restaurants{" "}
            {active === "all" ? "yet" : `with status “${active}”`}.
          </Card>
        ) : (
          <Card flush className="overflow-hidden">
            <div className="flex items-center gap-4 border-b border-border px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              <span className="flex-1">Restaurant</span>
              <span className="w-48">Owner</span>
              <span className="w-28">Joined</span>
              <span className="w-24">Status</span>
            </div>
            {shown.map((r) => (
              <Link
                key={r.id}
                href={`/admin/restaurants/${r.id}`}
                className="flex items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-bone-deep"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.cuisine} · {r.neighborhood}
                  </p>
                </div>
                <span className="w-48 truncate text-sm text-muted-foreground">
                  {r.owner?.display_name ?? "—"}
                </span>
                <span className="w-28 font-mono text-xs text-muted-foreground">
                  {shortDate(r.created_at)}
                </span>
                <span className="w-24">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]",
                      STATUS_TONE[r.status],
                    )}
                  >
                    {r.status}
                  </span>
                </span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
