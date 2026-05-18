// Diner pay screen for a claim. Shows offer summary, asks for the check
// subtotal, and submits to payClaim.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import {
  expiresInMinutes,
  getClaimsForDiner,
  isClaimActive,
} from "@/lib/db/claims";
import { getMyDefaultCard } from "@/lib/db/cards";
import { centsToUsd } from "@/lib/money";

import { payClaim } from "./actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function PayClaimPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole("diner");
  const { id } = await params;
  const { error } = await searchParams;

  // We use the same query as the claims list; this is small data and
  // simpler than adding a one-off getClaimById helper.
  const claims = await getClaimsForDiner();
  const claim = claims.find((c) => c.id === id);
  if (!claim || !claim.offer) notFound();

  if (!isClaimActive(claim)) {
    return (
      <main className="flex flex-1 items-start justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="font-serif text-2xl font-semibold">
            Claim no longer active
          </h1>
          <p className="text-sm text-muted-foreground">
            This claim has expired or already been paid.
          </p>
          <Link href="/app/claims" className="text-sm underline underline-offset-4">
            Back to your claims
          </Link>
        </div>
      </main>
    );
  }

  const defaultCard = await getMyDefaultCard();
  if (!defaultCard) {
    // No card on file — send them to add one. They can come back via
    // the claim list and tap Pay again.
    redirect("/app/cards/add");
  }

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-5">
        <Link href="/app/claims" className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back to claims
        </Link>

        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            {claim.offer.restaurant?.name ?? "Restaurant"}
          </p>
          <h1 className="font-serif text-2xl font-semibold">{claim.offer.title}</h1>
          <p className="text-xs text-muted-foreground">
            Claim expires in {expiresInMinutes(claim)} min
          </p>
        </div>

        <form action={payClaim} className="space-y-4">
          <input type="hidden" name="claim_id" value={claim.id} />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Your check subtotal</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                type="number"
                name="subtotal"
                step="0.01"
                min={0}
                required
                placeholder="0.00"
                className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Ask your server for the pre-tax subtotal.
            </span>
          </label>

          <div className="rounded-md border border-border p-4 space-y-1 text-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              Discount
            </p>
            <p>
              <span className="font-medium">{claim.offer.discount_pct}% off</span>
              {claim.offer.min_spend_cents > 0 ? (
                <span className="text-muted-foreground">
                  {" "}
                  · min spend {centsToUsd(claim.offer.min_spend_cents)}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              An 8% platform fee is added to the discounted total. Charging{" "}
              <span className="capitalize">{defaultCard.brand}</span> ···· {defaultCard.last4}.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90"
          >
            Pay
          </button>
          <p className="text-xs text-muted-foreground text-center">
            Test mode — no real money moves until we go live.
          </p>
        </form>
      </div>
    </main>
  );
}
