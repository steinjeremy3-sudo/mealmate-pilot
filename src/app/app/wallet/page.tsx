// Diner Wallet — the diner's own stuff: offers they're holding
// ("Claimed") and cash back they've earned ("Rebates"). A segmented
// control switches between the two (server-rendered via ?show=).

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import {
  expiresInMinutes,
  getClaimsForDiner,
  isClaimActive,
} from "@/lib/db/claims";
import { getRebatesForDiner, type RebateStatus } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const REBATE_STATE: Record<RebateStatus, { label: string; tone: string }> = {
  initiated: { label: "processing", tone: "border-border bg-cream-warm text-muted-foreground" },
  sent: { label: "on the way", tone: "border-orange/30 bg-orange-tint text-orange-deep" },
  settled: { label: "landed", tone: "border-sage/40 bg-sage-tint text-sage" },
  failed: { label: "couldn't send", tone: "border-destructive/40 bg-rose/15 text-destructive" },
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  await requireRole("diner");
  const profile = await requireRole("diner");
  const { show } = await searchParams;
  const tab: "claimed" | "rebates" = show === "rebates" ? "rebates" : "claimed";

  const [claims, rebates] = await Promise.all([
    getClaimsForDiner(),
    getRebatesForDiner(profile.id),
  ]);

  const landedCents = rebates
    .filter((r) => r.status === "settled")
    .reduce((sum, r) => sum + r.amountCents, 0);
  const activeClaims = claims.filter(isClaimActive);
  const pastClaims = claims.filter((c) => !isClaimActive(c));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Wallet</Eyebrow>
          <Heading as="h1" size="display">
            {landedCents > 0 ? (
              <>
                <em>{centsToUsd(landedCents)}</em> back
              </>
            ) : (
              "Your wallet"
            )}
          </Heading>
        </div>

        {/* Segmented control */}
        <div className="flex gap-2">
          {(
            [
              ["claimed", "Claimed", "/app/wallet"],
              ["rebates", "Rebates", "/app/wallet?show=rebates"],
            ] as const
          ).map(([key, label, href]) => (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex-1 rounded-full border px-4 py-2 text-center text-sm font-medium transition-colors",
                tab === key
                  ? "border-ink bg-ink text-cream"
                  : "border-border bg-transparent text-ink hover:bg-cream-warm",
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {tab === "claimed" ? (
          claims.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted-foreground">
              No claims yet. Browse{" "}
              <Link href="/app" className="text-orange underline underline-offset-4">
                tonight&apos;s offers
              </Link>
              .
            </Card>
          ) : (
            <ul className="space-y-2">
              {activeClaims.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/claims/${c.id}`} className="block">
                    <Card className="border-sage/40 bg-sage-tint transition-colors hover:bg-sage-soft/40">
                      <p className="font-serif text-lg font-medium tracking-tight text-ink">
                        {c.offer?.title ?? "Offer"}
                      </p>
                      <p className="text-xs text-ink/70">
                        {c.offer?.restaurant?.name ?? "—"} · expires in{" "}
                        {expiresInMinutes(c)} min
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
              {pastClaims.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/claims/${c.id}`} className="block">
                    <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-cream-warm">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {c.offer?.title ?? "Offer"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.offer?.restaurant?.name ?? "—"} ·{" "}
                          {new Date(c.claimed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.status === "matched" || c.status === "consumed"
                          ? "redeemed"
                          : c.status === "cancelled"
                            ? "cancelled"
                            : "expired"}
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : rebates.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No rebates yet. Claim an offer, eat, pay with your linked card.
          </Card>
        ) : (
          <ul className="space-y-2">
            {rebates.map((r) => {
              const s = REBATE_STATE[r.status];
              return (
                <li key={r.id}>
                  <Link href={`/app/rebates/${r.id}`} className="block">
                    <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-cream-warm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {r.restaurantName ?? "Restaurant"}
                        </p>
                        <p className="mt-1">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              s.tone,
                            )}
                          >
                            {s.label}
                          </span>
                        </p>
                      </div>
                      <p className="shrink-0 font-serif text-xl font-medium text-orange">
                        {centsToUsd(r.amountCents)}
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
