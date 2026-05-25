// OAuth return from Astra's hosted card-connect.
//
// Astra redirects here with `?code=` once the diner connects a debit
// card. We exchange the code for the diner's Astra tokens, record
// their card, and bounce back to the setup screen.
//
// TEMPORARY DIAGNOSTIC BUILD: on any failure the screen surfaces the
// underlying detail (params received, redirect_uri, Astra's error)
// so we can see why the handoff failed. Trim the diagnostic block
// back to a plain message once the flow is confirmed working.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import {
  exchangeAuthorizationCode,
  getAstraUser,
  listCards,
} from "@/lib/astra/client";
import {
  setDinerAstraCard,
  upsertDinerAstraTokens,
} from "@/lib/db/diner-astra";
import { setPayoutMethod } from "@/lib/db/users-payout";
import { reportError } from "@/lib/observability/report";

type SearchParams = Promise<Record<string, string | undefined>>;

function returnUrlFrom(host: string): string {
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/app/rebates/setup/return`;
}

function Problem({
  message,
  detail,
}: {
  message: string;
  detail: string;
}) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <Eyebrow>Cash-back card</Eyebrow>
        <Heading as="h1" size="page">
          Couldn&apos;t connect that card
        </Heading>
        <Card className="text-sm text-muted-foreground">{message}</Card>
        <Card className="space-y-1 bg-bone-deep">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Diagnostic
          </p>
          <p className="break-words font-mono text-xs text-ink">{detail}</p>
        </Card>
        <Link
          href="/app/rebates/setup"
          className="inline-block text-sm text-paprika underline underline-offset-4"
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
  const params = await searchParams;
  const code = params.code;

  const paramKeys = Object.keys(params);
  const seen = `params: ${paramKeys.length ? paramKeys.join(", ") : "(none)"}`;

  if (params.error) {
    return (
      <Problem
        message="Astra reported a problem. Nothing was saved."
        detail={
          `${seen} · error="${params.error}"` +
          (params.error_description ? ` · ${params.error_description}` : "")
        }
      />
    );
  }
  if (!code) {
    return (
      <Problem
        message="Astra didn't return an authorization code. Nothing was saved."
        detail={seen}
      />
    );
  }

  const host = (await headers()).get("host") ?? "mealmate-pilot.vercel.app";
  const redirectUri = returnUrlFrom(host);

  let ok = false;
  let detail = "";
  try {
    const tokens = await exchangeAuthorizationCode(code, redirectUri);
    const astraUser = await getAstraUser(tokens.accessToken);
    await upsertDinerAstraTokens(profile.id, {
      astraUserId: astraUser.userId,
      tokens,
    });

    const cards = await listCards(tokens.accessToken);
    const card =
      cards.find((c) => c.type?.toLowerCase().includes("debit")) ?? cards[0];
    if (card) {
      await setDinerAstraCard(profile.id, {
        cardId: card.id,
        cardLast4: card.last4,
      });
      await setPayoutMethod(profile.id, "astra");
      ok = true;
    } else {
      detail = `token exchange OK — but GET /v1/cards returned ${cards.length} card(s)`;
    }
  } catch (err) {
    detail =
      `redirect_uri=${redirectUri} · ` +
      (err instanceof Error ? err.message : String(err));
    reportError({
      scope: "astra.card-connect.return",
      message: "Failed to complete the Astra card-connect return",
      meta: { userId: profile.id },
      cause: err,
    });
  }

  if (!ok) {
    return (
      <Problem
        message="Couldn't finish connecting your card. Nothing was charged."
        detail={detail || "unknown"}
      />
    );
  }

  redirect("/app/rebates/setup");
}
