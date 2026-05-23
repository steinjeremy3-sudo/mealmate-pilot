// Diner debit-card setup (Astra push-to-card).
//
// The diner connects a debit card through Astra's hosted card-connect
// page; Astra redirects back to /app/rebates/setup/return with an
// OAuth code. MealMate never sees the card number — Astra captures it.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { buttonVariants, Card, Eyebrow, Heading } from "@/components/brand";
import { cardConnectUrl } from "@/lib/astra/client";
import { getDinerAstraAccount } from "@/lib/db/diner-astra";

import { CardMockup } from "../../../cards/CardMockup";

function returnUrlFrom(host: string): string {
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/app/rebates/setup/return`;
}

export default async function CashBackDebitPage() {
  // Hide the screen entirely if the Astra rail isn't live yet.
  if (process.env.ASTRA_DEBIT_ENABLED !== "true") {
    redirect("/app/rebates/setup");
  }

  const profile = await requireRole("diner");
  const account = await getDinerAstraAccount(profile.id);
  const hasCard = !!account?.cardId;

  const host =
    (await headers()).get("host") ?? "mealmate-pilot.vercel.app";
  const connectUrl = cardConnectUrl(returnUrlFrom(host), profile.id);

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Cash-back card</Eyebrow>
          <Heading as="h1" size="display">
            {hasCard ? (
              <>
                Your <em>card.</em>
              </>
            ) : (
              <>
                Where your <em>cash back</em> lands.
              </>
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            Cash back is pushed straight to your debit card — it arrives in
            minutes, not days.
          </p>
        </div>

        {hasCard ? (
          <>
            <CardMockup
              mask={account?.cardLast4}
              label="Cash-back card"
            />
            <a
              href={connectUrl}
              className={buttonVariants({
                variant: "ghost",
                size: "md",
                className: "w-full",
              })}
            >
              Connect a different card
            </a>
          </>
        ) : (
          <>
            <Card className="space-y-2 text-sm text-foreground/80">
              <p>
                Connect the debit card you&apos;d like your cash back sent
                to. Astra captures it securely — MealMate never sees the
                card number.
              </p>
              <p className="text-muted-foreground">
                You&apos;ll step over to Astra, then come right back.
              </p>
            </Card>
            <a
              href={connectUrl}
              className={buttonVariants({
                size: "lg",
                className: "w-full",
              })}
            >
              Connect debit card
            </a>
          </>
        )}

        <Link
          href="/app/rebates/setup"
          className="block text-center text-xs text-muted-foreground underline underline-offset-4"
        >
          ← Choose a different payout method
        </Link>
      </div>
    </main>
  );
}
