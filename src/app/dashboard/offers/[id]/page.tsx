// Merchant: single offer detail. Shows budget, terms, and live-claim
// count; offers a Publish button when status is `draft`.

import Link from "next/link";
import { notFound } from "next/navigation";

import { Button, Card, Eyebrow } from "@/components/brand";
import { requireRole } from "@/lib/auth/require-role";
import { getActiveClaimCount } from "@/lib/db/claims";
import { getOfferById, type OfferStatus } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";
import {
  formatDayRange,
  formatDays,
  formatTimeRange,
} from "@/lib/offers/format";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/console/PageHeader";
import { endOffer, publishOffer } from "./actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

const OFFER_BADGE: Record<OfferStatus, string> = {
  draft: "border-border bg-bone-deep text-muted-foreground",
  scheduled: "border-paprika/50 bg-paprika/15 text-ink/80",
  live: "border-ink/15 bg-bone-deep text-ink",
  ended: "border-border bg-bone-deep text-muted-foreground",
};

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-border py-3 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export default async function MerchantOfferDetail({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole("merchant");

  const { id } = await params;
  const { error } = await searchParams;
  const offer = await getOfferById(id);
  if (!offer) notFound();

  const activeClaimCount = await getActiveClaimCount(offer.id);
  const cap = offer.max_claims_total;
  const capPct =
    cap && cap > 0 ? Math.min(100, Math.round((activeClaimCount / cap) * 100)) : 0;
  const remaining = cap != null ? Math.max(0, cap - activeClaimCount) : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/dashboard/offers"
            className="transition-colors hover:text-paprika"
          >
            ← All offers
          </Link>
        }
        title={offer.title}
        sub={`${formatDayRange(offer.valid_days)} · ${formatTimeRange(
          offer.valid_start_time,
          offer.valid_end_time,
        )} · min ${centsToUsd(offer.min_check_cents)}`}
        actions={
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.06em]",
              OFFER_BADGE[offer.status],
            )}
          >
            {offer.status}
          </span>
        }
      />

      <div className="px-10 py-8">
        <div className="w-full max-w-3xl space-y-6">
          <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
            {/* Terms */}
            <Card className="p-6">
              <h2 className="font-display text-xl tracking-tight">Terms</h2>
              <p className="pt-1 text-sm text-muted-foreground">
                {offer.description}
              </p>
              <dl className="mt-3 border-t border-border">
                <Fact k="Discount" v={`${offer.discount_pct}% off`} />
                <Fact
                  k="Minimum spend"
                  v={centsToUsd(offer.min_check_cents)}
                />
                <Fact k="Days" v={formatDays(offer.valid_days)} />
                <Fact
                  k="Daily window"
                  v={formatTimeRange(
                    offer.valid_start_time,
                    offer.valid_end_time,
                  )}
                />
                <Fact
                  k="Starts"
                  v={new Date(offer.starts_at).toLocaleDateString()}
                />
                <Fact
                  k="Ends"
                  v={
                    offer.ends_at
                      ? new Date(offer.ends_at).toLocaleDateString()
                      : "—"
                  }
                />
                {cap != null ? (
                  <Fact k="Cap" v={`${cap} redemptions`} />
                ) : null}
              </dl>
            </Card>

            {/* Redemptions */}
            {cap != null ? (
              <Card className="flex flex-col p-6">
                <Eyebrow tone="muted">Redemptions</Eyebrow>
                <p className="pb-2 pt-3 font-display text-4xl leading-none tracking-tight">
                  {activeClaimCount}
                </p>
                <p className="text-sm text-muted-foreground">
                  of {cap} used · {remaining} left
                </p>
                <span className="mt-4 block h-2 overflow-hidden rounded-full bg-border">
                  <span
                    className="block h-full rounded-full bg-paprika"
                    style={{ width: `${capPct}%` }}
                  />
                </span>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  Each active claim + confirmed visit counts; cancellations
                  and expirations free the slot.
                </p>
                {remaining === 0 ? (
                  <p className="mt-3 rounded-lg border border-paprika/40 bg-paprika-tint px-3 py-2 text-xs font-medium text-paprika-deep">
                    Cap reached — closed to new diners until a slot frees.
                  </p>
                ) : null}
              </Card>
            ) : (
              <Card className="flex flex-col items-start gap-2 p-6 text-sm text-muted-foreground">
                <Eyebrow tone="muted">Redemptions</Eyebrow>
                <p className="text-sm text-foreground">
                  No cap set — unlimited activations.
                </p>
                <p className="font-mono text-[11px]">
                  {activeClaimCount} active or matched so far.
                </p>
              </Card>
            )}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {/* Actions */}
          {offer.status === "draft" || offer.status === "live" ? (
            <Card className="space-y-4 p-6">
              {offer.status === "draft" ? (
                <form action={publishOffer} className="space-y-2">
                  <input type="hidden" name="offer_id" value={offer.id} />
                  <Button type="submit">Publish offer</Button>
                  <p className="text-xs text-muted-foreground">
                    Once published, this offer becomes visible to diners.
                  </p>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Live and visible to diners.
                </p>
              )}
              <form
                action={endOffer}
                className="space-y-2 border-t border-border pt-4"
              >
                <input type="hidden" name="offer_id" value={offer.id} />
                <button
                  type="submit"
                  className="cursor-pointer rounded-full border border-destructive bg-transparent px-4 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-white"
                >
                  End this offer
                </button>
                <p className="text-xs text-muted-foreground">
                  Diners who activated it keep their hour. Ended offers
                  disappear from diner browse.
                </p>
              </form>
            </Card>
          ) : (
            <Card className="text-sm text-muted-foreground">
              {offer.status === "ended"
                ? "This offer has ended."
                : "Scheduled."}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
