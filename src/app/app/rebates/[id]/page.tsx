// Diner rebate detail (B5) — the "processing / landed" surface for
// one rebate. The state panel carries the message; the breakdown
// shows where the number came from.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getRebateDetailForDiner } from "@/lib/db/rebates";
import { centsToUsd } from "@/lib/money";

export default async function DinerRebateDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole("diner");
  const { id } = await params;
  const r = await getRebateDetailForDiner(id, profile.id);
  if (!r) notFound();

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/app/rebates"
          className="text-sm text-muted-foreground transition-colors hover:text-paprika"
        >
          ← Back to wallet
        </Link>

        <div className="space-y-1">
          <Eyebrow>Cash back</Eyebrow>
          <Heading as="h1" size="page">
            {r.restaurantName ?? "Restaurant"}
          </Heading>
        </div>

        {/* State panel — the message changes with the rebate's state. */}
        {r.status === "initiated" || r.status === "sent" ? (
          <Card className="border-paprika/30 bg-paprika-tint">
            <p className="font-medium text-ink">
              {centsToUsd(r.amountCents)} is on the way.
            </p>
            <p className="mt-1 text-sm text-ink/70">
              We confirmed your visit and started your cash back — it&apos;ll
              land on your chosen payout method shortly.
            </p>
          </Card>
        ) : null}

        {r.status === "settled" ? (
          <Card className="border-paprika/30 bg-paprika-tint">
            <p className="font-medium text-ink">
              Your {centsToUsd(r.amountCents)} cash back landed.
            </p>
            <p className="mt-1 text-sm text-paprika-deep">
              It&apos;s on the account you linked
              {r.cardMask ? ` ····${r.cardMask}` : ""}.
            </p>
          </Card>
        ) : null}

        {r.status === "failed" ? (
          <Card className="space-y-2 border-destructive/40 bg-burnt/15">
            <p className="font-medium text-ink">
              We couldn&apos;t send this cash back.
            </p>
            <p className="text-sm text-ink/70">
              Something went wrong reaching your linked account. Check
              your cash-back destination and we&apos;ll try again.
            </p>
            <Link
              href="/app/rebates/setup"
              className="inline-block text-sm text-destructive underline underline-offset-4"
            >
              Review cash-back destination →
            </Link>
          </Card>
        ) : null}

        {/* Breakdown */}
        <Card className="space-y-1 text-sm">
          <Eyebrow tone="muted">Breakdown</Eyebrow>
          {r.checkAmountCents != null ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Check total</span>
              <span>{centsToUsd(r.checkAmountCents)}</span>
            </div>
          ) : null}
          {r.discountCents != null ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Discount{r.discountPct != null ? ` (${r.discountPct}%)` : ""}
              </span>
              <span>{centsToUsd(r.discountCents)}</span>
            </div>
          ) : null}
          {r.platformFeeCents != null ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Mealmate fee</span>
              <span>−{centsToUsd(r.platformFeeCents)}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-border pt-1 font-medium">
            <span>Your cash back</span>
            <span className="text-paprika-deep">
              {centsToUsd(r.amountCents)}
            </span>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          {r.transactionDate ? `Visit dated ${r.transactionDate}. ` : ""}
          Started {new Date(r.createdAt).toLocaleDateString()}.
        </p>
      </div>
    </main>
  );
}
