// Diner Help / FAQ — how Mealmate works, in a plain-language
// accordion. Native <details> so it stays a server component.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I get my cash back?",
    a: "Activate an offer, then eat at the restaurant and pay normally with your linked card. We confirm the visit within 1–2 days and send your cash back automatically — there's nothing to do on your end.",
  },
  {
    q: "Why do I need to link a card?",
    a: "We use read-only access to your card's transactions so we can confirm your restaurant visits. We never charge your card, and your bank login is handled by Plaid — never stored by Mealmate.",
  },
  {
    q: "What's the Mealmate fee?",
    a: "Mealmate keeps 6% of the discounted total as a platform fee, capped at $10. Your cash back is the discount minus that fee — the full breakdown shows on every cash-back detail page.",
  },
  {
    q: "Does the discount apply to specific menu items?",
    a: "No — the discount is applied to your whole check. Order whatever you want; the percentage off comes back as cash to your linked card.",
  },
  {
    q: "Can I pay with a different card?",
    a: "It needs to be a card you've linked to Mealmate — otherwise we have no way to confirm the visit. You can link more than one under Profile → Linked cards.",
  },
  {
    q: "What if I cancel an offer I activated?",
    a: "Cancel it anytime from the offer screen — there's no penalty. If you've already eaten and we've confirmed the visit, your cash back still comes through.",
  },
  {
    q: "Do restaurants see who I am?",
    a: "No. Restaurants see anonymous initials only. Mealmate shares aggregate stats with them — never your name and never your card.",
  },
];

export default async function DinerHelpPage() {
  await requireRole("diner");

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/app/profile"
          className="text-sm text-muted-foreground transition-colors hover:text-paprika"
        >
          ← Profile
        </Link>

        <div className="space-y-1.5">
          <Eyebrow>Help</Eyebrow>
          <Heading as="h1" size="display">
            Common questions
          </Heading>
        </div>

        <div className="space-y-2">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-border bg-bone px-4 py-3"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="shrink-0 text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>

        <Card className="text-sm text-muted-foreground">
          Still stuck? Email{" "}
          <a
            href="mailto:support@mealmate.co"
            className="text-paprika underline underline-offset-4"
          >
            support@mealmate.co
          </a>{" "}
          and we&apos;ll help.
        </Card>
      </div>
    </main>
  );
}
