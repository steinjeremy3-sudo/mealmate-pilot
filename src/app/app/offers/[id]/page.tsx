// Diner: offer detail with claim button.
//
// Shows a Claim button when the diner doesn't have an active claim, or
// an "already claimed — expires in N min" badge when they do.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import {
  expiresInMinutes,
  getActiveClaimForOffer,
} from "@/lib/db/claims";
import { getOfferById } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

import { cancelClaim } from "../../claims/actions";
import { claimOffer } from "./actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function formatDays(days: string[]): string {
  const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const FULL: Record<string, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };
  const sorted = [...days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return sorted.map((d) => FULL[d] ?? d).join(", ");
}

function formatTime(t: string): string {
  const [hStr, m] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

export default async function DinerOfferDetail({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole("diner");
  const { id } = await params;
  const { error } = await searchParams;

  const [offer, activeClaim] = await Promise.all([
    getOfferById(id),
    getActiveClaimForOffer(id),
  ]);
  if (!offer) notFound();

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-5">
        <Link href="/app" className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back
        </Link>

        <div className="space-y-2">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            {offer.restaurant?.name ?? "—"}
          </p>
          <h1 className="font-serif text-3xl font-semibold">{offer.title}</h1>
          <p className="text-base">{offer.description}</p>
        </div>

        <div className="rounded-lg bg-secondary/40 p-4 space-y-1 text-center">
          <p className="font-serif text-5xl font-semibold">{offer.discount_pct}%</p>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">off</p>
        </div>

        <dl className="space-y-2 text-sm">
          {offer.min_spend_cents > 0 ? (
            <div className="flex justify-between gap-4 border-b pb-2">
              <dt className="text-muted-foreground">Minimum spend</dt>
              <dd>{centsToUsd(offer.min_spend_cents)}</dd>
            </div>
          ) : null}

          <div className="flex justify-between gap-4 border-b pb-2">
            <dt className="text-muted-foreground">Days</dt>
            <dd className="text-right">{formatDays(offer.valid_days)}</dd>
          </div>

          <div className="flex justify-between gap-4 border-b pb-2">
            <dt className="text-muted-foreground">Hours</dt>
            <dd>
              {formatTime(offer.valid_start_time)} – {formatTime(offer.valid_end_time)}
            </dd>
          </div>

          <div className="flex justify-between gap-4 border-b pb-2">
            <dt className="text-muted-foreground">Where</dt>
            <dd className="text-right">
              {offer.restaurant?.address ?? "—"}
              <br />
              <span className="text-muted-foreground">
                {offer.restaurant?.neighborhood ?? "—"}
              </span>
            </dd>
          </div>
        </dl>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {activeClaim ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center space-y-3">
            <div className="space-y-1">
              <p className="font-medium text-emerald-900">
                You&apos;ve claimed this offer.
              </p>
              <p className="text-xs text-emerald-700">
                Expires in {expiresInMinutes(activeClaim)} min. Show this at
                the restaurant to redeem.
              </p>
              <Link
                href="/app/claims"
                className="text-xs underline underline-offset-4 text-emerald-900"
              >
                See all your claims →
              </Link>
            </div>
            <form action={cancelClaim} className="border-t border-emerald-200 pt-3">
              <input type="hidden" name="claim_id" value={activeClaim.id} />
              <button
                type="submit"
                className="text-xs text-emerald-900 underline underline-offset-4"
              >
                Cancel this claim
              </button>
            </form>
          </div>
        ) : (
          <form action={claimOffer}>
            <input type="hidden" name="offer_id" value={offer.id} />
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90"
            >
              Claim this offer
            </button>
            <p className="text-xs text-muted-foreground text-center pt-2">
              Claims hold for 1 hour. Pay-at-restaurant flow arrives in
              Phase 2d.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
