// Diner card management. Lists linked cards (from Plaid) and offers a
// "Link a card" CTA that opens Plaid Link. The empty state leads with
// the rotated Visa mockup + a plain-language read of what linking does.

import { CreditCard, Eye, ShieldCheck } from "lucide-react";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getMyPlaidCards } from "@/lib/db/plaid-cards";

import { CardMockup } from "./CardMockup";
import { createLinkToken, removeCard, setDefaultCard } from "./actions";
import { PlaidLinkButton } from "./PlaidLinkButton";

const ASSURANCES = [
  {
    Icon: ShieldCheck,
    text: "Bank-grade encryption. Your bank login goes to Plaid, never to Mealmate.",
  },
  {
    Icon: Eye,
    text: "Read-only. We see transaction amounts to confirm your visits — never your full card number.",
  },
  {
    Icon: CreditCard,
    text: "We never charge your card. Cash back is paid out to the debit card or bank account you choose.",
  },
];

export default async function CardsPage() {
  await requireRole("diner");
  const cards = await getMyPlaidCards();

  // Generate a fresh link_token on each render. Plaid tokens expire
  // after 4 hours; per-page-load is overkill but cheap and simple.
  const { linkToken } = await createLinkToken();

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Your cards</Eyebrow>
          <Heading as="h1" size="display">
            {cards.length === 0 ? (
              <>
                Link your card
              </>
            ) : (
              <>
                {cards.length} on file
              </>
            )}
          </Heading>
        </div>

        {cards.length === 0 ? (
          <>
            <div className="flex justify-center py-3">
              <div className="w-[280px] max-w-full rotate-[-6deg]">
                <CardMockup label="Your Visa" />
              </div>
            </div>
            <Card className="space-y-3">
              {ASSURANCES.map(({ Icon, text }) => (
                <div key={text} className="flex gap-3">
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-paprika"
                    strokeWidth={1.75}
                  />
                  <p className="text-sm text-foreground/80">{text}</p>
                </div>
              ))}
            </Card>
          </>
        ) : (
          <ul className="space-y-5">
            {cards.map((card) => (
              <li key={card.id} className="space-y-2">
                <CardMockup mask={card.mask} label={card.name ?? "Card"} />
                <div className="flex items-center justify-between px-1">
                  {card.is_default ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paprika">
                      Default card
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-4">
                    {!card.is_default ? (
                      <form action={setDefaultCard}>
                        <input type="hidden" name="card_id" value={card.id} />
                        <button
                          type="submit"
                          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-4 hover:text-paprika"
                        >
                          Make default
                        </button>
                      </form>
                    ) : null}
                    <form action={removeCard}>
                      <input type="hidden" name="card_id" value={card.id} />
                      <button
                        type="submit"
                        className="cursor-pointer text-xs text-destructive underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <PlaidLinkButton linkToken={linkToken} />

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Sandbox test: pick any bank, use{" "}
          <code className="font-mono text-foreground">user_good</code> /{" "}
          <code className="font-mono text-foreground">pass_good</code>. Select
          a credit card or checking account to link.
        </p>
      </div>
    </main>
  );
}
