// Marketing landing — single-page scroll mirroring mealmatedining.app.
// All copy ported verbatim from the standalone static site; rebuilt in
// the v2.0 brand system (Archivo Black + paprika + ink + bone) to
// match the platform.

import Link from "next/link";

import { Eyebrow } from "@/components/brand";
import { ContactForm } from "@/components/public/ContactForm";

const NEIGHBORHOODS = [
  "Bishop Arts",
  "Deep Ellum",
  "Uptown",
  "Knox-Henderson",
  "Lower Greenville",
];

// Bar chart data from the original site. Cover-rate-by-daypart
// visualisation in the Problem section.
const COVER_BARS: { label: string; pct: number }[] = [
  { label: "Mon dinner", pct: 58 },
  { label: "Mon lunch", pct: 32 },
  { label: "Tue dinner", pct: 38 },
  { label: "Wed dinner", pct: 46 },
  { label: "Thu dinner", pct: 62 },
  { label: "Fri dinner", pct: 86 },
  { label: "Sat dinner", pct: 92 },
  { label: "Sun brunch", pct: 44 },
];

const RESTAURANT_BULLETS = [
  {
    title: "You set the offer.",
    body: "Daypart, discount %, days of week, budget cap. Pause anytime. Change anytime.",
  },
  {
    title: "You keep your brand.",
    body: "No gimmicky coupons, no codes at the table, no public discount marketplace. The discount is quiet, automatic, and lives at the moment of payment.",
  },
  {
    title: "You see what's working.",
    body: "A live dashboard of incremental covers, average ticket, repeat-visit rate, and net revenue by daypart. Every dollar of discount is tied to a measurable cover — no impressions, no guesswork.",
  },
  {
    title: "You pay no fees.",
    body: "No subscription, no take-rate, no fee charged to you — you fund only the discounts you set. The diner absorbs a small platform fee on the discounted total.",
  },
];

const DINER_BULLETS = [
  {
    title: "Curated, not crowded.",
    body: "A short list of restaurants worth knowing, not a coupon flood. Independent kitchens across Dallas to start.",
  },
  {
    title: "Pay normally. Save automatically.",
    body: "Tap your linked card. The discount is already in the total. No codes, no QR, no awkward conversation at the table.",
  },
  {
    title: "Track what you save.",
    body: "A simple dashboard showing your savings across the year. No gamification, no points, no nonsense.",
  },
];

const WHY_NOW = [
  {
    n: "01",
    title: "Operators need measurable demand.",
    body: "Cost pressure has eliminated tolerance for generic awareness spend. Restaurants want spend that ties to incremental covers, not impressions.",
  },
  {
    n: "02",
    title: "Card-linked rails matured.",
    body: "The infrastructure for card-linked offers exists today in a way it didn't five years ago. Toast, Resy, and others have made the underlying plumbing real.",
  },
  {
    n: "03",
    title: "Diners already browse digitally.",
    body: "OpenTable serves 60,000+ restaurants and ingests 400,000+ reviews per month. Discovery is digital. Rewards aren't.",
  },
];

export default function MarketingLanding() {
  return (
    <>
      {/* ============ Hero ============ */}
      <section
        id="top"
        className="border-b border-border bg-bone"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:py-32">
          <div className="space-y-6">
            <Eyebrow>Dallas · Launching Summer 2026</Eyebrow>
            <h1 className="font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.03em]">
              Dine well.
              <br />
              Pay less.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Mealmate is a card-linked discount platform for
              independent restaurants. Operators fill their slow
              hours. Diners save automatically at the places they
              already love. No coupons. No POS changes.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="#contact"
                className="rounded-lg bg-ink px-6 py-3.5 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
              >
                Contact us →
              </Link>
              <Link
                href="/browse"
                className="rounded-lg border border-ink px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-bone-deep"
              >
                Browse offers
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Problem ============ */}
      <section className="border-b border-border bg-bone">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <Eyebrow>The inefficiency</Eyebrow>
            <h2 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.0] tracking-[-0.025em]">
              Empty seats,
              <br />
              every week.
            </h2>
            <div className="max-w-xl space-y-4 text-base leading-relaxed text-ink/80">
              <p>
                Most independent restaurants run at 30–40% capacity
                on weeknights and slow lunch shifts. Discounting is
                the obvious solution — and the obvious mistake.
                Public coupons train regulars to wait. Reservation
                discounts force restaurants onto a marketplace they
                don&apos;t control. Delivery apps take 30% and don&apos;t
                fill chairs.
              </p>
              <p>
                The result: restaurants either tolerate the empty
                seats or take painful steps that hurt their brand.
                Neither is good.
              </p>
              <p>
                Mealmate is a card-linked discount platform that lets
                independent restaurants fill their slow hours — and
                gives their best diners a way to dine more often, for
                less.
              </p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Cover rate · weekday %
            </p>
            <ul className="space-y-2.5">
              {COVER_BARS.map((b) => (
                <li
                  key={b.label}
                  className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {b.label}
                  </span>
                  <span className="relative h-3 rounded-full bg-bone-deep">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-ink"
                      style={{ width: `${b.pct}%` }}
                    />
                  </span>
                  <span className="text-right font-mono text-xs">
                    {b.pct}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-4 pt-2 text-[10px] font-mono uppercase tracking-[0.1em]">
              <span className="flex items-center gap-1.5 text-ink/70">
                <span className="size-2.5 rounded-sm bg-ink" />
                Occupied
              </span>
              <span className="flex items-center gap-1.5 text-paprika">
                <span className="size-2.5 rounded-sm bg-paprika" />
                Mealmate opportunity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ How it works ============ */}
      <section
        id="how-it-works"
        className="border-b border-border bg-bone-deep"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="space-y-6">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              A small loop. No coupons. No POS changes.
            </h2>
          </div>

          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "The restaurant sets a discount.",
                b: "Pick the daypart, pick the percentage, pick the budget cap. Pause anytime. Existing POS keeps running.",
              },
              {
                n: "02",
                t: "The diner pays normally.",
                b: "Linked card, normal payment. The discount applies at the moment of payment — no codes, no QR, no waiting.",
              },
              {
                n: "03",
                t: "The restaurant pays no fees.",
                b: "No subscription, no take-rate, no fee charged to the restaurant — you fund only the discounts you choose to run. The small platform fee is absorbed by the diner on the discounted total.",
              },
            ].map((s) => (
              <li key={s.n} className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paprika">
                  {s.n}
                </p>
                <h3 className="font-display text-2xl leading-tight tracking-[-0.02em]">
                  {s.t}
                </h3>
                <p className="text-sm leading-relaxed text-ink/75">
                  {s.b}
                </p>
              </li>
            ))}
          </ol>

          <p className="mx-auto mt-16 max-w-2xl text-center font-display text-2xl leading-snug tracking-[-0.02em] text-ink/80">
            The discount lives at the point of payment, not on a
            coupon site.
          </p>
        </div>
      </section>

      {/* ============ For Restaurants ============ */}
      <section
        id="for-restaurants"
        className="border-b border-border bg-bone"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="space-y-6">
            <Eyebrow>For restaurants</Eyebrow>
            <h2 className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              Built for operators, equipping them with a tool to
              drive demand when they need it most.
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-ink/80">
              Slow weeknights and quiet lunch shifts carry the same
              fixed costs as your busiest ones — but a fraction of
              the revenue. Mealmate is the lever: pick the daypart,
              set the discount, drive incremental covers exactly
              when you need them.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {RESTAURANT_BULLETS.map((b) => (
              <div key={b.title} className="space-y-2">
                <h4 className="font-display text-xl leading-tight tracking-[-0.02em]">
                  {b.title}
                </h4>
                <p className="text-sm leading-relaxed text-ink/75">
                  {b.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="#contact"
              className="rounded-lg bg-ink px-6 py-3.5 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
            >
              Contact us →
            </Link>
            <Link
              href="/sign-up?as=merchant"
              className="rounded-lg border border-ink px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-bone-deep"
            >
              List your restaurant
            </Link>
          </div>
        </div>
      </section>

      {/* ============ For Diners ============ */}
      <section
        id="for-diners"
        className="border-b border-border bg-bone-deep"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="space-y-6">
            <Eyebrow>For diners</Eyebrow>
            <h2 className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              A curated table of the restaurants you already love.
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-ink/80">
              Mealmate is not a coupon app. It&apos;s a smaller,
              hand-curated list of independent restaurants in your
              neighborhood — places worth knowing about — with
              automatic discounts at slow hours. You link your card
              once. The savings happen at payment.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {DINER_BULLETS.map((b) => (
              <div key={b.title} className="space-y-2">
                <h4 className="font-display text-xl leading-tight tracking-[-0.02em]">
                  {b.title}
                </h4>
                <p className="text-sm leading-relaxed text-ink/75">
                  {b.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/sign-up?as=diner"
              className="rounded-lg bg-ink px-6 py-3.5 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
            >
              Join the Dallas launch list →
            </Link>
            <Link
              href="/browse"
              className="rounded-lg border border-ink px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-bone"
            >
              Browse offers
            </Link>
          </div>
        </div>
      </section>

      {/* ============ Why Now ============ */}
      <section id="why-now" className="border-b border-border bg-ink text-bone">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="space-y-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paprika">
              Why now
            </p>
            <h2 className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              Three shifts converging on the same product shape.
            </h2>
          </div>

          <ol className="mt-14 grid gap-12 md:grid-cols-3">
            {WHY_NOW.map((s) => (
              <li key={s.n} className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paprika">
                  {s.n}
                </p>
                <h3 className="font-display text-xl leading-tight tracking-[-0.02em] text-bone">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-bone/70">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ About ============ */}
      <section id="about" className="border-b border-border bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <Eyebrow className="justify-center">The team</Eyebrow>
            <h2 className="font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              Built in Dallas.
            </h2>
            <p className="text-base leading-relaxed text-ink/80">
              Mealmate is a small team based in Dallas, working
              alongside independent operators in the city. We started
              here because Dallas has the right density of
              independent restaurants and the right kind of diners —
              people who care which restaurants stay open.
            </p>
            <p className="pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Built in Dallas, Texas · 2026
            </p>
          </div>
        </div>
      </section>

      {/* ============ Launch market ============ */}
      <section className="border-b border-border bg-bone-deep">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="space-y-6">
            <Eyebrow>Launch market</Eyebrow>
            <h2 className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              Dallas first. Then Texas. Then everywhere.
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-ink/80">
              We&apos;re launching summer 2026 with a small group of
              independent operators across Dallas — Bishop Arts,
              Knox-Henderson, Lower Greenville, Deep Ellum, Uptown.
              From there: other Texas metros. The strategy is simple
              — start dense, prove the loop, expand.
            </p>
          </div>

          <ul className="mt-10 flex flex-wrap gap-2">
            {NEIGHBORHOODS.map((n) => (
              <li
                key={n}
                className="rounded-full border border-ink/15 bg-bone px-4 py-2 text-sm font-medium text-ink"
              >
                {n}
              </li>
            ))}
            <li className="rounded-full border border-paprika/40 bg-paprika-tint px-4 py-2 text-sm font-medium text-paprika-deep">
              Launching summer 2026
            </li>
          </ul>
        </div>
      </section>

      {/* ============ Contact ============ */}
      <section id="contact" className="bg-bone">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <div className="space-y-4 text-center">
            <Eyebrow className="justify-center">Get in touch</Eyebrow>
            <h2 className="font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              Questions? Let&apos;s talk.
            </h2>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-ink/80">
              Restaurant operator, prospective diner, or just curious
              — send a note and we&apos;ll get back to you.
            </p>
          </div>

          <div className="mt-12">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
