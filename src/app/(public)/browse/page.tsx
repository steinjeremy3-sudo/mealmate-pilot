// Public browse — every live offer from an approved restaurant,
// visible without an account. Tap a card to view the restaurant page
// + menu; the activate CTA on /r/[id] kicks anon visitors to /sign-up.

import Link from "next/link";

import { Eyebrow } from "@/components/brand";
import { OfferTile, type OfferCardData } from "@/app/app/OfferCard";
import { getLiveOffers } from "@/lib/db/offers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function isAnon(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !user;
}

export default async function PublicBrowsePage() {
  const [offers, anon] = await Promise.all([
    getLiveOffers() as Promise<OfferCardData[]>,
    isAnon(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Eyebrow>Tonight in Dallas</Eyebrow>
          <h1 className="font-display text-[2.25rem] leading-[1.05] tracking-[-0.02em]">
            {offers.length} offer{offers.length === 1 ? "" : "s"} live
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Browse what every Mealmate partner is running tonight.
            Sign up free to activate one — cash back lands on your
            linked card automatically.
          </p>
        </div>
        {anon ? (
          <Link
            href="/sign-up?as=diner"
            className="shrink-0 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
          >
            Get started →
          </Link>
        ) : null}
      </div>

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-bone-deep p-12 text-center text-sm text-muted-foreground">
          Nothing live right now — check back soon.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {offers.map((o) => (
            <li key={o.id}>
              <OfferTile
                offer={o}
                href={o.restaurant ? `/r/${o.restaurant.id}` : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
