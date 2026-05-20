// Diner-side rebate destination setup.
//
// Phase 4d.2 ACH path: diners pick one of their Plaid-linked
// checking accounts. We mint a Plaid processor token, exchange for
// a Dwolla funding source, and store the URL. No card data, no
// iframe, no PCI scope — Plaid + Dwolla handle the financial bits.
//
// The diner only sees this page when:
//   (a) they have at least one matched_transactions row with a rebate
//       waiting on a destination, OR
//   (b) they navigate here proactively via /app nav.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import { getDinerDwollaAccount } from "@/lib/db/diner-dwolla";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { setRebateDestination } from "./actions";

type CheckingCard = {
  id: string;
  name: string | null;
  mask: string | null;
  subtype: string | null;
  institutionName: string | null;
};

export default async function RebatesSetupPage() {
  const profile = await requireRole("diner");
  const account = await getDinerDwollaAccount(profile.id);
  const cards = await loadDinerCheckingCards(profile.id);

  const isConfigured =
    !!account?.defaultCardFundingSourceUrl && cards.length > 0;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Rebate destination</Eyebrow>
          <Heading as="h1" size="display">
            {isConfigured ? (
              <>
                You&apos;re <em>set</em>
              </>
            ) : (
              "Pick a checking account"
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            MealMate sends your cash-back rebates via ACH to a linked
            checking account. Funds arrive in 1–2 business days.
          </p>
        </div>

        {cards.length === 0 ? (
          <Card className="space-y-2 border-dashed text-center text-sm text-muted-foreground">
            <p>
              You haven&apos;t linked a checking account yet. Link one
              first, then come back here.
            </p>
            <Link
              href="/app/cards"
              className="inline-block text-sm text-orange underline underline-offset-4"
            >
              Go to your cards →
            </Link>
          </Card>
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li key={card.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {card.institutionName ?? card.name ?? "Checking"}
                      {card.mask ? <> ···· {card.mask}</> : null}
                    </p>
                    {card.name ? (
                      <p className="text-xs text-muted-foreground">
                        {card.name}
                      </p>
                    ) : null}
                  </div>
                  <form action={setRebateDestination}>
                    <input
                      type="hidden"
                      name="plaid_card_account_id"
                      value={card.id}
                    />
                    <Button type="submit" size="sm">
                      Use this
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {isConfigured ? (
          <Card className="border-sage/40 bg-sage-tint text-xs text-ink/80">
            Pending rebates will start flowing within the next sync cycle.
          </Card>
        ) : null}

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Want instant rebates straight to your debit card? That&apos;s
          coming in a later phase — for now ACH is the path.
        </p>
      </div>
    </main>
  );
}

/**
 * All checking-type accounts the diner explicitly linked. We DON'T
 * call Plaid here — we use the cached subtype on plaid_card_accounts
 * (populated at link time since Phase 4d.2). Rows linked before that
 * have subtype=NULL; we surface them anyway so the diner can still
 * pick (Dwolla will validate at attach time).
 */
async function loadDinerCheckingCards(userId: string): Promise<CheckingCard[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("plaid_card_accounts")
    .select(
      `
      id, name, mask, subtype,
      plaid_items!inner ( user_id, institution_name )
      `,
    )
    .eq("status", "active")
    .eq("plaid_items.user_id", userId);
  if (error) {
    console.error("loadDinerCheckingCards:", error);
    return [];
  }
  // Filter: subtype must be 'checking' OR null (legacy rows we let
  // the diner try). 'credit card' subtype excluded.
  return (data ?? [])
    .filter((r) => r.subtype !== "credit card")
    .map((r) => {
      const item = Array.isArray(r.plaid_items)
        ? r.plaid_items[0]
        : r.plaid_items;
      return {
        id: r.id,
        name: r.name,
        mask: r.mask,
        subtype: r.subtype,
        institutionName: item?.institution_name ?? null,
      };
    });
}
