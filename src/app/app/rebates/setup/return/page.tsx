// OAuth return from Astra's hosted card-connect.
//
// Astra redirects here with `?code=` once the diner connects a debit
// card. We exchange the code for the diner's Astra tokens, record
// their card, and bounce back to the setup screen.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { exchangeAuthorizationCode, listCards } from "@/lib/astra/client";
import {
  setDinerAstraCard,
  upsertDinerAstraTokens,
} from "@/lib/db/diner-astra";
import { reportError } from "@/lib/observability/report";

type SearchParams = Promise<{ code?: string; state?: string; error?: string }>;

function returnUrlFrom(host: string): string {
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/app/rebates/setup/return`;
}

function Problem({ message }: { message: string }) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <Eyebrow>Cash-back card</Eyebrow>
        <Heading as="h1" size="page">
          Couldn&apos;t connect that card
        </Heading>
        <Card className="text-sm text-muted-foreground">{message}</Card>
        <Link
          href="/app/rebates/setup"
          className="inline-block text-sm text-orange underline underline-offset-4"
        >
          Try again →
        </Link>
      </div>
    </main>
  );
}

export default async function AstraReturnPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole("diner");
  const { code, error } = await searchParams;

  if (error) {
    return (
      <Problem message="Astra reported a problem connecting your card. Nothing was saved — give it another go." />
    );
  }
  if (!code) {
    return (
      <Problem message="The connection didn't complete. Nothing was saved — give it another go." />
    );
  }

  const host = (await headers()).get("host") ?? "mealmate-pilot.vercel.app";

  let ok = false;
  try {
    const tokens = await exchangeAuthorizationCode(code, returnUrlFrom(host));
    await upsertDinerAstraTokens(profile.id, { tokens });

    const cards = await listCards(tokens.accessToken);
    const card =
      cards.find((c) => c.type?.toLowerCase().includes("debit")) ?? cards[0];
    if (card) {
      await setDinerAstraCard(profile.id, {
        cardId: card.id,
        cardLast4: card.last4,
      });
    }
    ok = true;
  } catch (err) {
    reportError({
      scope: "astra.card-connect.return",
      message: "Failed to complete the Astra card-connect return",
      meta: { userId: profile.id },
      cause: err,
    });
  }

  if (!ok) {
    return (
      <Problem message="Something went wrong finishing the connection. Nothing was charged — please try again." />
    );
  }

  redirect("/app/rebates/setup");
}
