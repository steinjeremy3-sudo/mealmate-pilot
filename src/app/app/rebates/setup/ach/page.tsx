// Diner ACH setup (Dwolla → bank account).
//
// Picks one of the diner's Plaid-linked checking accounts; the action
// mints a Plaid processor token for Dwolla and attaches it as the
// diner's rebate funding source. Credit-card rows are filtered out
// here — Dwolla will only accept depository accounts anyway.

import Link from "next/link";

import {
  buttonVariants,
  Card,
  Eyebrow,
  Heading,
} from "@/components/brand";
import { requireRole } from "@/lib/auth/require-role";
import { getDinerDwollaAccount } from "@/lib/db/diner-dwolla";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { setRebateDestination } from "../actions";

type CheckingAccount = {
  id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
};

async function getCheckingAccounts(): Promise<CheckingAccount[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plaid_card_accounts")
    .select("id, name, official_name, mask, subtype, status")
    .eq("status", "active")
    .eq("subtype", "checking")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getCheckingAccounts:", error);
    return [];
  }
  return (data ?? []) as CheckingAccount[];
}

export default async function CashBackAchPage() {
  const profile = await requireRole("diner");
  const [dwollaAccount, accounts] = await Promise.all([
    getDinerDwollaAccount(profile.id),
    getCheckingAccounts(),
  ]);
  const hasDestination = !!dwollaAccount?.defaultCardFundingSourceUrl;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Bank account</Eyebrow>
          <Heading as="h1" size="display">
            {hasDestination ? (
              <>
                Your bank
              </>
            ) : (
              <>
                Where your cash back lands
              </>
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            Cash back deposits into your checking account in 1–2 business
            days.
          </p>
        </div>

        {hasDestination ? (
          <Card className="space-y-2 text-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-paprika">
              Connected
            </p>
            <p className="text-foreground/80">
              Your bank account is set up to receive cash back.
            </p>
          </Card>
        ) : accounts.length === 0 ? (
          <Card className="space-y-3 text-sm text-foreground/80">
            <p>
              You don&apos;t have a checking account linked yet. Add one
              through Plaid first — you&apos;ll grant Mealmate read-only
              access; we never see your card number.
            </p>
            <Link
              href="/app/cards"
              className={buttonVariants({
                size: "lg",
                className: "w-full",
              })}
            >
              Link a checking account →
            </Link>
          </Card>
        ) : (
          <form action={setRebateDestination} className="space-y-3">
            <p className="text-sm text-foreground/80">
              Pick the checking account you&apos;d like your cash back
              deposited to.
            </p>
            {accounts.map((acc, i) => (
              <label
                key={acc.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5",
                  "hover:border-paprika has-[:checked]:border-paprika has-[:checked]:bg-paprika/5",
                )}
              >
                <input
                  type="radio"
                  name="plaid_card_account_id"
                  value={acc.id}
                  required
                  defaultChecked={i === 0}
                  className="accent-paprika"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {acc.official_name ?? acc.name ?? "Checking"}
                  </p>
                  {acc.mask ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      ···· {acc.mask}
                    </p>
                  ) : null}
                </div>
              </label>
            ))}
            <button
              type="submit"
              className={buttonVariants({
                size: "lg",
                className: "w-full",
              })}
            >
              Use this account
            </button>
          </form>
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
