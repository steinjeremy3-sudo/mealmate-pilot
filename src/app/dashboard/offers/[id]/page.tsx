// Merchant: single offer detail. Shows everything; offers a Publish
// button when status is `draft`.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getOfferById } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

import { publishOffer } from "./actions";

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
  // postgres time arrives as "HH:MM:SS"; trim seconds for readability.
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

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <Link href="/dashboard/offers" className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back to offers
        </Link>

        <div className="rounded-lg border border-border p-6 space-y-4">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              {offer.restaurant?.name ?? "—"} · {offer.status}
            </p>
            <h1 className="font-serif text-3xl font-semibold">{offer.title}</h1>
            <p className="text-sm text-muted-foreground pt-2">{offer.description}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-2 border-t">
            <dt className="text-muted-foreground">Discount</dt>
            <dd>{offer.discount_pct}% off</dd>

            <dt className="text-muted-foreground">Minimum spend</dt>
            <dd>{centsToUsd(offer.min_spend_cents)}</dd>

            <dt className="text-muted-foreground">Days</dt>
            <dd>{formatDays(offer.valid_days)}</dd>

            <dt className="text-muted-foreground">Daily window</dt>
            <dd>
              {formatTime(offer.valid_start_time)} – {formatTime(offer.valid_end_time)}
            </dd>

            <dt className="text-muted-foreground">Starts</dt>
            <dd>{new Date(offer.starts_at).toLocaleString()}</dd>

            <dt className="text-muted-foreground">Ends</dt>
            <dd>{offer.ends_at ? new Date(offer.ends_at).toLocaleString() : "—"}</dd>
          </dl>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {offer.status === "draft" ? (
            <form action={publishOffer} className="pt-2 border-t">
              <input type="hidden" name="offer_id" value={offer.id} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Publish
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                Once published, this offer becomes visible to diners.
              </p>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground pt-2 border-t">
              {offer.status === "live"
                ? "Live and visible to diners."
                : offer.status === "ended"
                  ? "This offer has ended."
                  : "Scheduled."}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
