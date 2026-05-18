// Diner cards list.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getMyCards } from "@/lib/db/cards";

import { removeCard, setDefaultCard } from "./actions";

export default async function CardsPage() {
  await requireRole("diner");
  const cards = await getMyCards();

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Your cards
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {cards.length === 0 ? "No cards yet" : `${cards.length} on file`}
          </h1>
        </div>

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            Add a card to pay for offers at the restaurant.
          </p>
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li
                key={card.id}
                className="rounded-md border border-border p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="font-medium capitalize">
                    {card.brand} ···· {card.last4}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
                  </p>
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

        <Link
          href="/app/cards/add"
          className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add a card
        </Link>
      </div>
    </main>
  );
}
