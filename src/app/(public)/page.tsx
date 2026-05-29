// Landing — offers-first. Mirrors the diner-app feel: a quiet
// greeting, then live offers prominent at the top. Marketing context
// sits in compact sections below. The operator pitch lives at
// /for-restaurants; the bottom of this page links there for any
// merchant who lands here first.

import Link from "next/link";

import { Eyebrow } from "@/components/brand";
import {
  HeroOffer,
  OfferTile,
  type OfferCardData,
} from "@/app/app/OfferCard";
import { getLiveOffers } from "@/lib/db/offers";

const HOW_IT_WORKS = [
  {
    n: "01",
    t: "Browse",
    b: "See what every Mealmate partner is running tonight — no account needed.",
  },
  {
    n: "02",
    t: "Activate + eat",
    b: "Sign up, link a card, and tap activate. Eat at the restaurant and pay normally.",
  },
  {
    n: "03",
    t: "Cash back lands",
    b: "We confirm your visit and send the discount back to your linked card or bank.",
  },
];

export default async function MarketingLanding() {
  const offers = (await getLiveOffers()) as OfferCardData[];
  const [hero, ...rest] = offers;

  return (
    <>
      {/* ============ Hero · offers ============ */}
      <section className="border-b border-border bg-bone">
        <div className="mx-auto max-w-6xl px-6 pt-14 pb-20">
          <div className="mb-10 space-y-3">
            <Eyebrow>Dallas · Tonight</Eyebrow>
            <h1 className="max-w-3xl font-display text-[clamp(2.25rem,5.5vw,4rem)] leading-[1.0] tracking-[-0.025em]">
              A curated table of independent restaurants.
              <br />
              <span className="text-paprika">Cash back at every visit.</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              Browse what&apos;s live, sign up free, link a card, and
              save automatically at the places you already love. No
              coupons. No codes at the table.
            </p>
          </div>

          {offers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-bone-deep p-14 text-center text-sm text-muted-foreground">
              No live offers yet — first partners launching summer
              2026.
            </div>
          ) : (
            <div className="space-y-8">
              {hero ? (
                <HeroOffer
                  offer={hero}
                  href={
                    hero.restaurant
                      ? `/r/${hero.restaurant.id}`
                      : undefined
                  }
                />
              ) : null}

              {rest.length > 0 ? (
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {rest.map((o) => (
                    <li key={o.id}>
                      <OfferTile
                        offer={o}
                        href={
                          o.restaurant
                            ? `/r/${o.restaurant.id}`
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex items-center justify-between border-t border-border pt-6">
                <Link
                  href="/browse"
                  className="text-sm font-medium text-ink underline underline-offset-4 transition-colors hover:text-paprika"
                >
                  Browse every offer →
                </Link>
                <Link
                  href="/sign-up?as=diner"
                  className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
                >
                  Get started
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============ How it works ============ */}
      <section className="border-b border-border bg-bone-deep">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="space-y-3">
            <Eyebrow>How Mealmate works</Eyebrow>
            <h2 className="max-w-3xl font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.05] tracking-[-0.025em]">
              No coupons. No codes. The discount lives at the moment
              of payment.
            </h2>
          </div>

          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <li key={s.n} className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paprika">
                  {s.n}
                </p>
                <h3 className="font-display text-xl leading-tight tracking-[-0.02em]">
                  {s.t}
                </h3>
                <p className="text-sm leading-relaxed text-ink/75">
                  {s.b}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ About ============ */}
      <section className="border-b border-border bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <Eyebrow className="justify-center">Built in Dallas</Eyebrow>
            <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.05] tracking-[-0.025em]">
              A small team, alongside independent operators.
            </h2>
            <p className="text-base leading-relaxed text-ink/80">
              We started in Dallas because it has the right density
              of independent restaurants and the right kind of
              diners — people who care which restaurants stay open.
              Launching summer 2026 across Bishop Arts, Knox-
              Henderson, Lower Greenville, Deep Ellum, and Uptown.
            </p>
          </div>
        </div>
      </section>

      {/* ============ Restaurant callout ============ */}
      <section className="bg-ink text-bone">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paprika">
              For restaurants
            </p>
            <p className="font-display text-2xl leading-tight tracking-[-0.02em] text-bone">
              Run a restaurant? See how Mealmate helps you fill slow
              hours without hurting your brand.
            </p>
          </div>
          <Link
            href="/for-restaurants"
            className="shrink-0 rounded-lg bg-paprika px-6 py-3.5 text-sm font-semibold text-bone transition-colors hover:bg-paprika-deep"
          >
            For restaurants →
          </Link>
        </div>
      </section>
    </>
  );
}
