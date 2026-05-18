// Card-add page. Creates a SetupIntent on the server, then renders the
// Stripe Elements form (a client component) with the client_secret.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";

import { createSetupIntent } from "../actions";
import { CardAddForm } from "./CardAddForm";

export default async function AddCardPage() {
  await requireRole("diner");
  const { clientSecret } = await createSetupIntent();

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-5">
        <Link href="/app/cards" className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back to cards
        </Link>

        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Add a card
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            We won&apos;t charge anything yet.
          </h1>
          <p className="text-sm text-muted-foreground">
            We save the card so you can pay at the restaurant in one tap.
          </p>
        </div>

        <CardAddForm clientSecret={clientSecret} />

        <p className="text-xs text-muted-foreground border-t pt-3">
          Test mode: use card{" "}
          <code className="font-mono">4242 4242 4242 4242</code>, any future
          expiry, any CVC, any ZIP. Real cards won&apos;t be charged yet.
        </p>
      </div>
    </main>
  );
}
