// Diner: offer detail. Phase 2b: read-only — claim flow lands in 2c.
//
// RLS lets diners see only `live` offers from `approved` restaurants;
// anything else 404s.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { getOfferById } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

type Params = Promise<{ id: string }>;

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
  // postgres time → "HH:MM" → human "5:00 PM".
  const [hStr, m] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

export default async function DinerOfferDetail({
  params,
}: {
  params: Params;
}) {
  await requireRole("diner");
  const { id } = await params;
  const offer = await getOfferById(id);
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

        <p className="text-xs text-muted-foreground text-center pt-4 border-t">
          Claim & pay flow arrives in Phase 2c.
        </p>
      </div>
    </main>
  );
}
