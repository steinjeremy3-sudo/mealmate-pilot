// Diner Wallet — the diner's own activity in three tabs:
//   Active    — claims currently held (eat + pay to redeem)
//   Pending   — rebates matched, money still in flight
//   Completed — rebates that landed in the bank account
// A monthly-savings card sits on top. Tab is server-rendered via ?show=.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading, PlaceholderImg } from "@/components/brand";
import {
  expiresInMinutes,
  getClaimsForDiner,
  isClaimActive,
} from "@/lib/db/claims";
import { getRebatesForDiner, type RebateStatus } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";
import { dinerDisplayPct, netifyDiscountCopy } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Tab = "active" | "pending" | "completed";

// Pending-tab status badges (the in-flight rebate states).
const REBATE_STATE: Partial<Record<RebateStatus, { label: string; tone: string }>> = {
  initiated: {
    label: "processing",
    tone: "border-border bg-bone-deep text-muted-foreground",
  },
  sent: {
    label: "on the way",
    tone: "border-paprika/30 bg-paprika-tint text-paprika-deep",
  },
  failed: {
    label: "couldn't send",
    tone: "border-destructive/40 bg-burnt/15 text-destructive",
  },
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const profile = await requireRole("diner");
  const { show } = await searchParams;
  const tab: Tab =
    show === "pending" ? "pending" : show === "completed" ? "completed" : "active";

  const [claims, rebates] = await Promise.all([
    getClaimsForDiner(),
    getRebatesForDiner(profile.id),
  ]);

  const activeClaims = claims.filter(isClaimActive);
  const pastClaims = claims.filter((c) => !isClaimActive(c));
  const pendingRebates = rebates.filter((r) => r.status !== "settled");
  const completedRebates = rebates.filter((r) => r.status === "settled");

  const now = new Date();
  const monthSavedCents = completedRebates
    .filter((r) => {
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, r) => sum + r.amountCents, 0);
  const monthLabel = now.toLocaleDateString("en-US", { month: "long" });

  const tabs: { key: Tab; label: string; count: number; href: string }[] = [
    { key: "active", label: "Active", count: activeClaims.length, href: "/app/wallet" },
    {
      key: "pending",
      label: "Pending",
      count: pendingRebates.length,
      href: "/app/wallet?show=pending",
    },
    {
      key: "completed",
      label: "Completed",
      count: completedRebates.length,
      href: "/app/wallet?show=completed",
    },
  ];

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Wallet</Eyebrow>
          <Heading as="h1" size="display">
            Your wallet
          </Heading>
        </div>

        {/* Monthly savings → dashboard */}
        <Link href="/app/savings" className="block">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink p-5 text-bone transition-transform active:scale-[0.99]">
            <div>
              <Eyebrow tone="muted" className="text-bone/60">
                {monthLabel} so far
              </Eyebrow>
              <p className="mt-1.5 font-display text-3xl">
                <span className="text-paprika">
                  {centsToUsd(monthSavedCents)}
                </span>{" "}
                saved
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-xs">
              Dashboard →
            </span>
          </div>
        </Link>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-border">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                "-mb-px border-b-2 pb-3 pt-1 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-ink text-ink"
                  : "border-transparent text-muted-foreground hover:text-ink",
              )}
            >
              {t.label}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {t.count}
              </span>
            </Link>
          ))}
        </div>

        {/* ===== Active ===== */}
        {tab === "active" ? (
          activeClaims.length === 0 && pastClaims.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted-foreground">
              No active offers yet. Browse{" "}
              <Link
                href="/app"
                className="text-paprika underline underline-offset-4"
              >
                tonight&apos;s offers
              </Link>
              .
            </Card>
          ) : (
            <div className="space-y-5">
              {activeClaims.length > 0 ? (
                <ul className="space-y-3">
                  {activeClaims.map((c) => {
                    const name = c.offer?.restaurant?.name ?? "Restaurant";
                    return (
                      <li key={c.id}>
                        <Link href={`/app/claims/${c.id}`} className="block">
                          <div className="flex items-center gap-3.5 rounded-2xl border border-paprika/30 bg-paprika-tint p-3 transition-colors hover:bg-bone-deep">
                            <PlaceholderImg
                              name={name}
                              className="size-[70px] shrink-0 rounded-xl"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-display text-lg text-ink">
                                {name}
                              </p>
                              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/60">
                                Expires in {expiresInMinutes(c)} min
                              </p>
                              <span className="mt-2 inline-flex items-center rounded-full bg-paprika px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.05em] text-white">
                                {c.offer
                                  ? dinerDisplayPct(c.offer.discount_pct)
                                  : 0}
                                % off
                              </span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {pastClaims.length > 0 ? (
                <div className="space-y-2">
                  <Eyebrow tone="muted">Past offers</Eyebrow>
                  <ul className="space-y-2">
                    {pastClaims.map((c) => (
                      <li key={c.id}>
                        <Link href={`/app/claims/${c.id}`} className="block">
                          <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-bone-deep">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {c.offer?.restaurant?.name ?? "Restaurant"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {c.offer
                                  ? netifyDiscountCopy(
                                      c.offer.title,
                                      c.offer.discount_pct,
                                    )
                                  : "Offer"}{" "}
                                ·{" "}
                                {new Date(c.claimed_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {c.status === "matched" || c.status === "consumed"
                                ? "confirmed"
                                : c.status === "cancelled"
                                  ? "cancelled"
                                  : "expired"}
                            </span>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )
        ) : null}

        {/* ===== Pending ===== */}
        {tab === "pending" ? (
          pendingRebates.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted-foreground">
              No cash back in flight. Confirmed visits show here while we
              send it.
            </Card>
          ) : (
            <ul className="space-y-3">
              {pendingRebates.map((r) => {
                const s = REBATE_STATE[r.status];
                return (
                  <li key={r.id}>
                    <Link href={`/app/rebates/${r.id}`} className="block">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bone p-4 transition-colors hover:bg-bone-deep">
                        <div className="min-w-0">
                          <p className="truncate font-display text-base">
                            {r.restaurantName ?? "Restaurant"}
                          </p>
                          {s ? (
                            <span
                              className={cn(
                                "mt-1.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                s.tone,
                              )}
                            >
                              {s.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="shrink-0 font-mono text-base">
                          {centsToUsd(r.amountCents)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {/* ===== Completed ===== */}
        {tab === "completed" ? (
          completedRebates.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted-foreground">
              No cash back yet. Activate an offer, eat, pay with your linked
              card.
            </Card>
          ) : (
            <ul>
              {completedRebates.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/rebates/${r.id}`} className="block">
                    <div className="flex items-center gap-3.5 border-b border-border py-4">
                      <PlaceholderImg
                        name={r.restaurantName ?? "Restaurant"}
                        className="size-11 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base">
                          {r.restaurantName ?? "Restaurant"}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          {shortDate(r.transactionDate ?? r.createdAt)} ·
                          landed
                        </p>
                      </div>
                      <p className="shrink-0 font-display text-lg text-paprika">
                        +{centsToUsd(r.amountCents)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </main>
  );
}
