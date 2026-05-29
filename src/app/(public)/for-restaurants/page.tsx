// Operator pitch — the merchant-facing marketing content. Single
// scroll, mirrors the structure of the original mealmatedining.app
// site but focused only on the restaurant side: Problem → For
// Restaurants → Why Now → Contact.

import Link from "next/link";

import { Eyebrow } from "@/components/brand";
import { ContactForm } from "@/components/public/ContactForm";

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

export default function ForRestaurantsPage() {
  return (
    <>
      {/* ============ Hero ============ */}
      <section className="border-b border-border bg-bone">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 lg:grid-cols-[1.2fr_1fr] lg:py-32">
          <div className="space-y-6">
            <Eyebrow>For restaurants</Eyebrow>
            <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.03em]">
              Empty seats,
              <br />
              every week.
            </h1>
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
                Mealmate is a card-linked discount platform that
                lets independent restaurants fill their slow hours.
                Pick the daypart, set the discount, drive
                incremental covers exactly when you need them.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/sign-up?as=merchant"
                className="rounded-lg bg-ink px-6 py-3.5 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
              >
                List your restaurant →
              </Link>
              <Link
                href="#contact"
                className="rounded-lg border border-ink px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-bone-deep"
              >
                Talk to us
              </Link>
            </div>
          </div>

          {/* Bar chart */}
          <div className="space-y-4 lg:pt-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Cover rate · weekday %
            </p>
            <ul className="space-y-2.5">
              {COVER_BARS.map((b) => (
                <li
                  key={b.label}
                  className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3"
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
            <div className="flex gap-4 pt-2 font-mono text-[10px] uppercase tracking-[0.1em]">
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

      {/* ============ Four bullets ============ */}
      <section className="border-b border-border bg-bone-deep">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="space-y-6">
            <Eyebrow>What you get</Eyebrow>
            <h2 className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              Built for operators, equipping them with a tool to
              drive demand when they need it most.
            </h2>
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
        </div>
      </section>

      {/* ============ Why Now ============ */}
      <section className="border-b border-border bg-ink text-bone">
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

      {/* ============ Contact ============ */}
      <section id="contact" className="bg-bone">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <div className="space-y-4 text-center">
            <Eyebrow className="justify-center">Get in touch</Eyebrow>
            <h2 className="font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em]">
              Questions? Let&apos;s talk.
            </h2>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-ink/80">
              Restaurant operator, prospective diner, or just
              curious — send a note and we&apos;ll get back to you.
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
