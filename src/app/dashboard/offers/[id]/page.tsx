// Merchant: single offer detail. Shows everything; offers a Publish
// button when status is `draft`.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import { getActiveClaimCount } from "@/lib/db/claims";
import { getOfferById } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

import { endOffer, publishOffer } from "./actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function formatDays(days: string[]): string {
  const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const SHORT: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };
  const sorted = [...days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return sorted.map((d) => SHORT[d] ?? d).join(" · ");
}

function formatTime(t: string): string {
  return t.slice(0, 5);
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

  const activeClaimCount =
    offer.status === "live" ? await getActiveClaimCount(offer.id) : 0;

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/dashboard/offers"
          className="text-sm text-muted-foreground transition-colors hover:text-orange"
        >
          ← Back to offers
        </Link>

        <Card className="space-y-4 p-6">
          <div className="space-y-1">
            <Eyebrow>
              {offer.restaurant?.name ?? "—"} · {offer.status}
            </Eyebrow>
            <Heading as="h1" size="page">
              {offer.title}
            </Heading>
            <p className="pt-1 text-sm text-muted-foreground">
              {offer.description}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
            <dt className="text-muted-foreground">Discount</dt>
            <dd>{offer.discount_pct}% off</dd>

            <dt className="text-muted-foreground">Minimum spend</dt>
            <dd>{centsToUsd(offer.min_check_cents)}</dd>

            <dt className="text-muted-foreground">Days</dt>
            <dd>{formatDays(offer.valid_days)}</dd>

            <dt className="text-muted-foreground">Daily window</dt>
            <dd>
              {formatTime(offer.valid_start_time)} –{" "}
              {formatTime(offer.valid_end_time)}
            </dd>

            <dt className="text-muted-foreground">Starts</dt>
            <dd>{new Date(offer.starts_at).toLocaleString()}</dd>

            <dt className="text-muted-foreground">Ends</dt>
            <dd>
              {offer.ends_at ? new Date(offer.ends_at).toLocaleString() : "—"}
            </dd>

            {offer.status === "live" ? (
              <>
                <dt className="text-muted-foreground">Active claims</dt>
                <dd>
                  <span className="font-medium">{activeClaimCount}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    diner{activeClaimCount === 1 ? "" : "s"} holding right
                    now
                  </span>
                </dd>
              </>
            ) : null}
          </dl>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {offer.status === "draft" || offer.status === "live" ? (
            <div className="space-y-3 border-t border-border pt-3">
              {offer.status === "draft" ? (
                <form action={publishOffer}>
                  <input type="hidden" name="offer_id" value={offer.id} />
                  <Button type="submit">Publish</Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Once published, this offer becomes visible to diners.
                  </p>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Live and visible to diners.
                </p>
              )}
              <form action={endOffer} className="pt-2">
                <input type="hidden" name="offer_id" value={offer.id} />
                <button
                  type="submit"
                  className="cursor-pointer rounded-full border border-destructive bg-transparent px-4 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-white"
                >
                  End this offer
                </button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Active claims keep their hour to redeem. Ended offers
                  disappear from diner browse.
                </p>
              </form>
            </div>
          ) : (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              {offer.status === "ended"
                ? "This offer has ended."
                : "Scheduled."}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
