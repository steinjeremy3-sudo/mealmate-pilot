// Merchant Help / FAQ — how Mealmate works for operators, in a plain-
// language accordion. Native <details> so it stays a server component.

import { requireRole } from "@/lib/auth/require-role";
import { Card } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do offers work?",
    a: "You set the discount percentage (15–50%), the days and hours it's valid, a minimum check size, and a monthly budget cap. Diners activate the offer, dine during your window, and pay normally. You can pause or change an offer at any time — changes apply going forward.",
  },
  {
    q: "Does the discount come off specific menu items?",
    a: "No — the discount applies to the whole check. There's nothing to ring up differently at the table; the diner pays in full and receives the discount back as cash to their linked card.",
  },
  {
    q: "What does Mealmate cost me?",
    a: "There's no subscription and no take-rate. You fund only the discounts you offer on real, confirmed visits. The diner absorbs a small platform fee out of their cash back — it never comes out of your pocket.",
  },
  {
    q: "How does billing / settlement work?",
    a: "Once a week we total the discounts from your confirmed visits and send you a Stripe invoice for that amount, due in 7 days. You'll get an email from us and the invoice directly from Stripe. Your Settlements page shows the full breakdown.",
  },
  {
    q: "Why do I need to set up Stripe?",
    a: "Stripe handles the verification (KYC) and the weekly settlement billing. You can't publish offers until your Stripe account is active — it usually takes a few minutes after you finish onboarding, and we email you when it's ready.",
  },
  {
    q: "What counts as a visit?",
    a: "A diner who activated your offer, ate during the valid window, and paid with their linked card. We confirm the charge 1–2 days later, then it appears in your dashboard and rolls into the weekly settlement.",
  },
  {
    q: "Do I see who my diners are?",
    a: "No. You see anonymous initials and aggregate stats only — never a diner's name or card details.",
  },
];

export default async function MerchantHelpPage() {
  await requireRole("merchant");

  return (
    <>
      <PageHeader
        eyebrow="Help"
        title={<>Common questions</>}
        sub="How Mealmate works for your restaurant"
      />
      <div className="px-10 py-8">
        <div className="w-full max-w-2xl space-y-2">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-border bg-card px-5 py-4"
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

          <Card className="!mt-6 text-sm text-muted-foreground">
            Still have a question? Email{" "}
            <a
              href="mailto:support@mealmatedining.com"
              className="text-paprika underline underline-offset-4"
            >
              support@mealmatedining.com
            </a>{" "}
            and we&apos;ll help.
          </Card>
        </div>
      </div>
    </>
  );
}
