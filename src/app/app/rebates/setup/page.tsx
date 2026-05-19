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
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Rebate destination
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {isConfigured ? "You're set up" : "Pick a checking account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            MealMate sends your cash-back rebates via ACH to a linked
            checking account. Funds arrive in 1–2 business days.
          </p>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground space-y-2 text-center">
            <p>
              You haven&apos;t linked a checking account yet. Link one
              first, then come back here.
            </p>
            <Link
              href="/app/cards"
              className="inline-block text-sm underline underline-offset-4 text-foreground"
            >
              Go to /app/cards →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li
                key={card.id}
                className="rounded-md border border-border p-4 flex items-start justify-between gap-3"
              >
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
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Use this
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {isConfigured ? (
          <p className="text-xs text-emerald-700 border border-emerald-200 rounded-md p-3">
            Pending rebates will start flowing within the next sync
            cycle.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground border-t pt-3">
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
