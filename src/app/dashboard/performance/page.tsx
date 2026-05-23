// Merchant Performance — KPIs + visit trends over a date range.
//
// Reduced scope: no daypart heatmap (matched transactions store only
// a date, no time of day). Day-of-week is the closest honest view.

import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/brand";
import { KpiCard } from "@/components/console/KpiCard";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import { getMatchedTransactionsForMerchantSince } from "@/lib/db/merchant-settlements";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function MerchantPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const { range } = await searchParams;
  const r = RANGES.find((x) => x.key === range) ?? RANGES[1];

  const since = new Date();
  since.setDate(since.getDate() - r.days);
  const sinceStr = since.toISOString().slice(0, 10);

  const txns = await getMatchedTransactionsForMerchantSince(sinceStr);

  // KPIs.
  const visits = txns.length;
  const checkTotal = txns.reduce((s, t) => s + t.amountCents, 0);
  const avgCheck = visits ? Math.round(checkTotal / visits) : 0;
  const discountTotal = txns.reduce((s, t) => s + (t.discountCents ?? 0), 0);

  // Visits per day across the range.
  const days: { key: string; count: number }[] = [];
  for (let i = r.days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      key,
      count: txns.filter((t) => t.transactionDate === key).length,
    });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  // Visits by day of week.
  const byDow = WEEKDAYS.map(
    (_, i) =>
      txns.filter((t) => new Date(t.transactionDate).getDay() === i).length,
  );
  const maxDow = Math.max(1, ...byDow);

  // Visits + discount by offer.
  const offerMap = new Map<string, { visits: number; discount: number }>();
  for (const t of txns) {
    const key = t.offerTitle ?? "(unattributed)";
    const e = offerMap.get(key) ?? { visits: 0, discount: 0 };
    e.visits += 1;
    e.discount += t.discountCents ?? 0;
    offerMap.set(key, e);
  }
  const byOffer = [...offerMap.entries()]
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.visits - a.visits);

  return (
    <>
      <PageHeader
        eyebrow={restaurant.name}
        title={
          <>
            How you&apos;re <em>doing.</em>
          </>
        }
        sub="Visits MealMate confirmed at your restaurant over the chosen window."
      />

      <div className="space-y-8 px-10 py-8">
        {/* Range */}
        <div className="flex gap-2">
          {RANGES.map((x) => (
            <Link
              key={x.key}
              href={`/dashboard/performance?range=${x.key}`}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                r.key === x.key
                  ? "border-ink bg-ink text-cream"
                  : "border-border bg-transparent text-ink hover:bg-cream-warm",
              )}
            >
              Last {x.label}
            </Link>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Visits" value={String(visits)} />
          <KpiCard label="Checks total" value={centsToUsd(checkTotal)} />
          <KpiCard
            label="Avg check"
            value={visits ? centsToUsd(avgCheck) : "—"}
          />
          <KpiCard label="Discount given" value={centsToUsd(discountTotal)} />
        </div>

        {visits === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No confirmed visits in this window yet.
          </Card>
        ) : (
          <>
            {/* Visits over time */}
            <Card className="p-6">
              <h2 className="font-serif text-xl tracking-tight">
                Visits over time
              </h2>
              <p className="text-xs text-muted-foreground">
                Daily, last {r.label}.
              </p>
              <div className="mt-4 flex h-32 items-end gap-0.5">
                {days.map((d) => (
                  <div
                    key={d.key}
                    title={`${d.key}: ${d.count}`}
                    className="flex-1 rounded-t bg-orange"
                    style={{
                      height: `${Math.max(2, (d.count / maxDay) * 100)}%`,
                    }}
                  />
                ))}
              </div>
            </Card>

            {/* By day of week */}
            <Card className="p-6">
              <h2 className="font-serif text-xl tracking-tight">
                By day of week
              </h2>
              <p className="text-xs text-muted-foreground">
                Where your week is busiest.
              </p>
              <div className="mt-4 flex h-36 items-end gap-2">
                {byDow.map((count, i) => (
                  <div
                    key={WEEKDAYS[i]}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-ink"
                        style={{
                          height: `${Math.max(2, (count / maxDow) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {WEEKDAYS[i]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* By offer */}
            <div className="space-y-3">
              <h2 className="font-serif text-xl tracking-tight">By offer</h2>
              <Card flush className="overflow-hidden">
                {byOffer.map((o) => (
                  <div
                    key={o.title}
                    className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {o.title}
                    </span>
                    <span className="w-24 text-right font-mono text-sm">
                      {o.visits} visit{o.visits === 1 ? "" : "s"}
                    </span>
                    <span className="w-24 text-right font-mono text-sm text-orange-deep">
                      −{centsToUsd(o.discount)}
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
