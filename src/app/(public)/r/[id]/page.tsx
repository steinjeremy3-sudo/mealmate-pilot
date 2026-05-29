// Public restaurant page — visible to anon visitors. Shows photo,
// neighborhood, the live offer, and the full menu with strikethrough
// discounted prices. Activate CTA pushes anon visitors to /sign-up;
// signed-in diners are forwarded to the regular claim flow.

import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Eyebrow, PlaceholderImg } from "@/components/brand";
import { getMenuForRestaurant, groupBySection } from "@/lib/db/menu";
import { getLiveOffers } from "@/lib/db/offers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { centsToUsd } from "@/lib/money";
import { formatDayRange, formatTimeRange } from "@/lib/offers/format";

type Params = Promise<{ id: string }>;

export default async function PublicRestaurantPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  // Find a live offer for this restaurant. `getLiveOffers` is
  // anon-readable (RLS allows). If there's no live offer we 404 —
  // anon discovery is offer-driven.
  const offers = await getLiveOffers();
  const offer = offers.find((o) => o.restaurant?.id === id);
  if (!offer || !offer.restaurant) notFound();

  const r = offer.restaurant;
  const menu = await getMenuForRestaurant(id);
  const sections = groupBySection(menu);

  // Is the visitor signed in as a diner? If so, route activation to
  // the real claim flow; otherwise kick them to sign-up.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthedDiner = Boolean(user); // role check is downstream
  const activateHref = isAuthedDiner
    ? `/app/offers/${offer.id}/claim`
    : `/sign-up?as=diner`;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <Link
        href="/browse"
        className="text-sm text-muted-foreground transition-colors hover:text-paprika"
      >
        ← Browse
      </Link>

      <div className="mt-6 space-y-6">
        {/* Hero */}
        <PlaceholderImg
          name={r.name}
          caption={`${r.cuisine} · ${r.neighborhood}`}
          showName
          className="h-56 rounded-2xl"
        />

        {/* Offer card */}
        <div className="rounded-2xl bg-ink p-6 text-bone">
          <Eyebrow tone="muted" className="text-bone/60">
            Live offer
          </Eyebrow>
          <p className="mt-2 font-display text-3xl text-paprika">
            {offer.discount_pct}% off your whole check
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-bone/70">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-bone/50">
                Days
              </p>
              <p className="mt-1">
                {formatDayRange(offer.valid_days) || "See offer"}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-bone/50">
                Window
              </p>
              <p className="mt-1">
                {formatTimeRange(
                  offer.valid_start_time,
                  offer.valid_end_time,
                )}
              </p>
            </div>
            {offer.min_check_cents > 0 ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-bone/50">
                  Minimum check
                </p>
                <p className="mt-1">{centsToUsd(offer.min_check_cents)}</p>
              </div>
            ) : null}
          </div>

          <Link
            href={activateHref}
            className="mt-6 block w-full rounded-lg bg-paprika py-3.5 text-center text-[15px] font-semibold text-bone transition-colors hover:bg-paprika-deep"
          >
            {isAuthedDiner ? "Activate offer" : "Sign up to activate"}
          </Link>
          {!isAuthedDiner ? (
            <p className="mt-2 text-center text-xs text-bone/55">
              Free to sign up · cash back lands on your linked card
            </p>
          ) : null}
        </div>

        {/* Menu */}
        <div>
          <Eyebrow>Menu</Eyebrow>
          {sections.length === 0 ? (
            <Card className="mt-3 border-dashed text-center text-sm text-muted-foreground">
              {r.name} hasn&apos;t published a menu yet.
            </Card>
          ) : (
            <div className="mt-3 space-y-6">
              {sections.map((s) => (
                <section key={s.section} className="space-y-1">
                  <h2 className="border-b border-border pb-2 font-display text-xl tracking-tight">
                    {s.section}
                  </h2>
                  <ul>
                    {s.items.map((it) => {
                      const discountedCents = Math.round(
                        it.priceCents * (1 - offer.discount_pct / 100),
                      );
                      return (
                        <li
                          key={it.id}
                          className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 text-sm last:border-b-0"
                        >
                          <span>{it.name}</span>
                          <span className="flex shrink-0 items-baseline gap-2 font-mono">
                            <s className="text-muted-foreground">
                              {centsToUsd(it.priceCents)}
                            </s>
                            <span className="text-paprika">
                              {centsToUsd(discountedCents)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {r.address ? (
          <Card className="bg-bone-deep text-sm text-ink/80">
            <Eyebrow tone="muted">Address</Eyebrow>
            <p className="mt-1.5">{r.address}, Dallas, TX</p>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
