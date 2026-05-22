// Diner claim detail. Adapts to the claim's state:
//   - ?placed=1 + active   → just-placed success screen (dark hero)
//   - claimed + not expired → active panel + "how this works" steps
//   - matched / consumed    → "redeemed; rebate processing"
//   - claimed + past expiry → "expired"
//   - cancelled             → "cancelled"
//
// In the rebate model the diner pays at the POS — no in-app pay step.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading, PlaceholderImg } from "@/components/brand";
import {
  expiresInMinutes,
  getClaimByIdForDiner,
  isClaimActive,
} from "@/lib/db/claims";

import { cancelClaim } from "../actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ placed?: string }>;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Google Maps "search" deep link — opens directions to an address. */
function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default async function DinerClaimDetail({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole("diner");
  const { id } = await params;
  const { placed } = await searchParams;

  const claim = await getClaimByIdForDiner(id);
  if (!claim || !claim.offer) notFound();

  const isActive = isClaimActive(claim);
  const isRedeemed = claim.status === "matched" || claim.status === "consumed";
  const isCancelled = claim.status === "cancelled";
  const isExpired = !isActive && !isRedeemed && !isCancelled;
  const r = claim.offer.restaurant;
  const name = r?.name ?? "the restaurant";

  // ===== Just-placed success screen =====
  if (placed && isActive) {
    return (
      <main className="flex flex-1 flex-col bg-ink-deep px-7 py-12 text-cream-soft">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="mb-8 flex size-20 items-center justify-center rounded-full bg-sage text-cream-soft">
            <Check className="size-10" strokeWidth={2.5} />
          </span>
          <Eyebrow className="mb-4">Offer activated</Eyebrow>
          <Heading as="h1" size="display" className="text-cream-soft">
            You&apos;re <em>all set.</em>
          </Heading>
          <p className="max-w-xs text-[15px] leading-relaxed text-cream/70">
            Head to {name} and pay normally with your linked card. We&apos;ll
            confirm your visit and send your cash back within 1–2 days.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <PlaceholderImg
              name={name}
              className="size-14 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <p className="truncate font-serif text-lg text-cream-soft">
                {name}
              </p>
              <p className="truncate text-xs text-cream/60">
                {claim.offer.discount_pct}% off
                {r?.neighborhood ? ` · ${r.neighborhood}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <a
              href={mapsUrl(r?.address ?? name)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-full bg-orange py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-orange-deep"
            >
              Get directions
            </a>
            <Link
              href="/app/wallet"
              className="flex-1 rounded-full border border-white/30 py-3.5 text-center text-[15px] font-semibold text-cream-soft transition-colors hover:bg-white/5"
            >
              View in wallet
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md">
      {/* Hero */}
      <div className="relative">
        <PlaceholderImg
          name={name}
          caption={r?.neighborhood}
          label="Photo"
          showName
          className="h-44"
        />
        <Link
          href="/app/wallet"
          aria-label="Back to wallet"
          className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-full bg-cream-soft text-ink shadow-sm transition-colors hover:bg-cream-warm"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </Link>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="space-y-2">
          <Eyebrow>{name}</Eyebrow>
          <Heading as="h1" size="page">
            {claim.offer.title}
          </Heading>
          <p className="text-xs text-muted-foreground">
            Activated {formatDateTime(claim.claimed_at)}
          </p>
        </div>

        {/* ===== State-specific panel ===== */}
        {isActive ? (
          <Card className="space-y-3 border-sage/40 bg-sage-tint text-center">
            <p className="font-medium text-ink">
              Offer active — expires in {expiresInMinutes(claim)} min
            </p>
            <p className="text-xs text-ink/70">
              Eat at {name} and pay with your linked card. We&apos;ll confirm
              your visit and send your cash back within 1–2 business days.
            </p>
            <form action={cancelClaim} className="border-t border-sage/30 pt-3">
              <input type="hidden" name="claim_id" value={claim.id} />
              <button
                type="submit"
                className="cursor-pointer rounded-full border border-sage/40 bg-cream-soft px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream-warm"
              >
                Cancel this offer
              </button>
            </form>
          </Card>
        ) : null}

        {isRedeemed ? (
          <Card className="space-y-2 border-orange/30 bg-orange-tint">
            <p className="font-medium text-ink">Cash back on its way</p>
            <p className="text-xs text-ink/70">
              We confirmed your visit. Your cash back posts to your linked
              account within 1–2 business days.
            </p>
          </Card>
        ) : null}

        {isExpired ? (
          <Card className="space-y-1 text-center text-sm">
            <p className="font-medium">Offer expired</p>
            <p className="text-xs text-muted-foreground">
              The transaction didn&apos;t come through in time. Re-activate
              from the offer page if it&apos;s still live.
            </p>
            <Link
              href={`/app/offers/${claim.offer.id}`}
              className="inline-block pt-1 text-xs text-orange underline underline-offset-4"
            >
              See offer
            </Link>
          </Card>
        ) : null}

        {isCancelled ? (
          <Card className="space-y-1 text-center text-sm">
            <p className="font-medium">Offer cancelled</p>
            <p className="text-xs text-muted-foreground">
              You cancelled this offer. Re-activate from the offer page if
              it&apos;s still live.
            </p>
            <Link
              href={`/app/offers/${claim.offer.id}`}
              className="inline-block pt-1 text-xs text-orange underline underline-offset-4"
            >
              See offer
            </Link>
          </Card>
        ) : null}

        {/* ===== How this works (active only) ===== */}
        {isActive ? (
          <Card className="space-y-3 bg-cream-warm">
            <Eyebrow>How this works</Eyebrow>
            <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-ink/80 marker:text-muted-foreground">
              <li>Eat at {name} before your offer expires.</li>
              <li>Pay normally with your linked card.</li>
              <li>We confirm your visit within 1–2 days.</li>
              <li>Your cash back lands in your bank account.</li>
            </ol>
          </Card>
        ) : null}

        {/* ===== Offer details (always shown) ===== */}
        <Card className="space-y-2 text-sm">
          {claim.offer.description ? (
            <p>{claim.offer.description}</p>
          ) : null}
          <div className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
            <p>
              {r?.address ?? "—"}
              {r?.neighborhood ? ` · ${r.neighborhood}` : ""}
            </p>
            <p>{claim.offer.discount_pct}% off</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
