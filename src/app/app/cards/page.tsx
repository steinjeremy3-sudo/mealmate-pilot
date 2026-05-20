// Diner card management. Lists linked cards (from Plaid) and offers
// a "Link a card" CTA that opens Plaid Link.

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getMyPlaidCards } from "@/lib/db/plaid-cards";

import { createLinkToken, removeCard, setDefaultCard } from "./actions";
import { PlaidLinkButton } from "./PlaidLinkButton";

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
              "Link your card"
            ) : (
              <>
                <em>{cards.length}</em> on file
              </>
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            We use Plaid to read your card&apos;s transactions so we can
            match your restaurant visits and rebate you. We never see your
            full card number.
          </p>
        </div>

        {cards.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No cards linked yet. Tap below to connect one via Plaid.
          </Card>
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li key={card.id}>
                <Card className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {card.name ?? "Card"}
                      {card.mask ? <> ···· {card.mask}</> : null}
                    </p>
                    {card.official_name ? (
                      <p className="text-xs text-muted-foreground">
                        {card.official_name}
                      </p>
                    ) : null}
                    {card.is_default ? (
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-sage">
                        Default
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {!card.is_default ? (
                      <form action={setDefaultCard}>
                        <input type="hidden" name="card_id" value={card.id} />
                        <button
                          type="submit"
                          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-4 hover:text-orange"
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
                </Card>
              </li>
            ))}
          </ul>
        )}

        <PlaidLinkButton linkToken={linkToken} />

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Sandbox test: pick any bank, use{" "}
          <code className="font-mono text-foreground">user_good</code> /{" "}
          <code className="font-mono text-foreground">pass_good</code>.
          Select a credit card or checking account to link.
        </p>
      </div>
    </main>
  );
}
