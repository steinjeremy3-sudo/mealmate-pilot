// Diner rebate history (B5). Every rebate the diner has earned, with
// its state — and a lifetime "landed" total.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getDinerRebateBannerSummary } from "@/lib/db/diner-rebate-status";
import { getRebatesForDiner, type RebateStatus } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";

const STATE: Record<RebateStatus, { label: string; tone: string }> = {
  initiated: {
    label: "processing",
    tone: "border-border bg-cream-warm text-muted-foreground",
  },
  sent: {
    label: "on the way",
    tone: "border-orange/30 bg-orange-tint text-orange-deep",
  },
  settled: {
    label: "landed",
    tone: "border-sage/40 bg-sage-tint text-sage",
  },
  failed: {
    label: "couldn't send",
    tone: "border-destructive/40 bg-rose/15 text-destructive",
  },
};

function StatePill({ status }: { status: RebateStatus }) {
  const s = STATE[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.tone}`}
    >
      {s.label}
    </span>
  );
}

export default async function DinerRebatesPage() {
  const profile = await requireRole("diner");
  const [rebates, banner] = await Promise.all([
    getRebatesForDiner(profile.id),
    getDinerRebateBannerSummary(profile.id),
  ]);

  const landedCents = rebates
    .filter((r) => r.status === "settled")
    .reduce((sum, r) => sum + r.amountCents, 0);

  const showSetupBanner =
    !banner.hasDestination && banner.initiatedCents > 0;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Your rebates</Eyebrow>
          <Heading as="h1" size="display">
            {landedCents > 0 ? (
              <>
                <em>{centsToUsd(landedCents)}</em> back
              </>
            ) : (
              "Rebates"
            )}
          </Heading>
        </div>

        {showSetupBanner ? (
          <Link href="/app/rebates/setup" className="block">
            <Card className="border-orange/30 bg-orange-tint transition-colors hover:bg-orange-soft/30">
              <p className="font-medium text-ink">
                {centsToUsd(banner.initiatedCents)} waiting on a
                destination.
              </p>
              <p className="mt-1 text-sm text-orange-deep">
                Pick where rebates land →
              </p>
            </Card>
          </Link>
        ) : null}

        {rebates.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No rebates yet. Claim an offer, eat, pay with your linked card
            — your cash back shows up here.
          </Card>
        ) : (
          <ul className="space-y-2">
            {rebates.map((r) => (
              <li key={r.id}>
                <Link href={`/app/rebates/${r.id}`} className="block">
                  <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-cream-warm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {r.restaurantName ?? "Restaurant"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.transactionDate ??
                          new Date(r.createdAt).toLocaleDateString()}
                      </p>
                      <p className="mt-1.5">
                        <StatePill status={r.status} />
                      </p>
                    </div>
                    <p className="shrink-0 font-serif text-xl font-medium text-orange">
                      {centsToUsd(r.amountCents)}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
