// Diner card management. Lists linked cards (from Plaid) and offers
// a "Link a card" CTA that opens Plaid Link.

import { requireRole } from "@/lib/auth/require-role";
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
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Your cards
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {cards.length === 0 ? "Link your card" : `${cards.length} on file`}
          </h1>
          <p className="text-sm text-muted-foreground">
            We use Plaid to read your card&apos;s transactions so we can match
            your restaurant visits and rebate you. We never see your full card
            number.
          </p>
        </div>

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            No cards linked yet. Tap below to connect one via Plaid.
          </p>
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li
                key={card.id}
                className="rounded-md border border-border p-4 flex items-start justify-between gap-3"
              >
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
                    <p className="text-xs text-emerald-700 mt-1">Default</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!card.is_default ? (
                    <form action={setDefaultCard}>
                      <input type="hidden" name="card_id" value={card.id} />
                      <button
                        type="submit"
                        className="text-xs underline underline-offset-4"
                      >
                        Make default
                      </button>
                    </form>
                  ) : null}
                  <form action={removeCard}>
                    <input type="hidden" name="card_id" value={card.id} />
                    <button
                      type="submit"
                      className="text-xs text-destructive underline underline-offset-4"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <PlaidLinkButton linkToken={linkToken} />

        <p className="text-xs text-muted-foreground border-t pt-3">
          Sandbox test: pick any bank, use{" "}
          <code className="font-mono">user_good</code> /{" "}
          <code className="font-mono">pass_good</code>. Select a credit card or
          checking account to link.
        </p>
      </div>
    </main>
  );
}
