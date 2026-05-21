// Diner savings dashboard — year-to-date cash back, computed from the
// diner's settled rebates. Reached from the Wallet monthly card.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, PlaceholderImg } from "@/components/brand";
import { getRebatesForDiner } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Whole-dollar string for the hero number ("$1,284"). */
function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="font-serif text-2xl tracking-tight">{value}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
    </Card>
  );
}

export default async function SavingsPage() {
  const profile = await requireRole("diner");
  const rebates = (await getRebatesForDiner(profile.id)).filter(
    (r) => r.status === "settled",
  );

  const now = new Date();
  const year = now.getFullYear();
  const ytd = rebates.filter((r) => new Date(r.createdAt).getFullYear() === year);
  const ytdCents = ytd.reduce((sum, r) => sum + r.amountCents, 0);
  const visits = ytd.length;
  const spots = new Set(ytd.map((r) => r.restaurantName ?? "—")).size;
  const avgCents = visits ? Math.round(ytdCents / visits) : 0;

  // Last 6 months of settled rebates → bar chart.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const cents = rebates
      .filter((r) => {
        const x = new Date(r.createdAt);
        return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear();
      })
      .reduce((sum, r) => sum + r.amountCents, 0);
    return {
      label: d.toLocaleDateString("en-US", { month: "short" }),
      cents,
      current: i === 5,
    };
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.cents));

  // Top spots by total cash back.
  const byRestaurant = new Map<string, { cents: number; visits: number }>();
  for (const r of ytd) {
    const key = r.restaurantName ?? "Restaurant";
    const entry = byRestaurant.get(key) ?? { cents: 0, visits: 0 };
    entry.cents += r.amountCents;
    entry.visits += 1;
    byRestaurant.set(key, entry);
  }
  const topSpots = [...byRestaurant.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 4);

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-7">
        <Link
          href="/app/wallet"
          className="text-sm text-muted-foreground transition-colors hover:text-orange"
        >
          ← Back to wallet
        </Link>

        <div className="space-y-1">
          <Eyebrow>{year} so far</Eyebrow>
          <p className="pb-2 font-serif text-[72px] italic leading-none text-orange">
            {dollars(ytdCents)}
          </p>
          <p className="text-base text-foreground/80">
            {visits === 0 ? (
              "No rebates yet this year — claim an offer to get started."
            ) : (
              <>
                across <strong className="font-medium">{visits} meals</strong>{" "}
                at{" "}
                <strong className="font-medium">
                  {spots} restaurant{spots === 1 ? "" : "s"}
                </strong>
                .
              </>
            )}
          </p>
        </div>

        {visits > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <Stat value={String(visits)} label="Meals" />
              <Stat value={centsToUsd(avgCents)} label="Per visit" />
              <Stat value={String(spots)} label="Spots tried" />
            </div>

            <div className="space-y-3">
              <Eyebrow tone="muted">Monthly</Eyebrow>
              <Card>
                <div className="flex h-36 items-end gap-2">
                  {months.map((m) => (
                    <div
                      key={m.label}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={cn(
                            "w-full rounded-t",
                            m.current ? "bg-orange" : "bg-border",
                          )}
                          style={{
                            height: `${Math.max(2, (m.cents / maxMonth) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-muted-foreground">
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {topSpots.length > 0 ? (
              <div className="space-y-3">
                <Eyebrow tone="muted">Top spots</Eyebrow>
                <ul className="space-y-2.5">
                  {topSpots.map((spot, i) => (
                    <li key={spot.name}>
                      <Card className="flex items-center gap-3.5 p-3.5">
                        <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <PlaceholderImg
                          name={spot.name}
                          className="size-11 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-base">
                            {spot.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {spot.visits} visit{spot.visits === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="shrink-0 font-serif text-lg text-sage">
                          {centsToUsd(spot.cents)}
                        </span>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
