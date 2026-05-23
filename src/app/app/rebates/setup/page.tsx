// Cash-back destination chooser.
//
// Two rails today: Astra push-to-debit-card (fast — minutes, gated
// behind ASTRA_DEBIT_ENABLED while the vendor enables it on our
// account) and Dwolla ACH to a checking account (1–2 business days).
// If the diner has already picked one — either explicitly via
// users.payout_method or implicitly by completing a setup flow — we
// short-circuit to a summary with a "switch" affordance.

import Link from "next/link";
import { ArrowRight, Building2, Wallet } from "lucide-react";

import {
  buttonVariants,
  Card,
  Eyebrow,
  Heading,
} from "@/components/brand";
import { requireRole } from "@/lib/auth/require-role";
import { getDinerAstraAccount } from "@/lib/db/diner-astra";
import { getDinerDwollaAccount } from "@/lib/db/diner-dwolla";
import { getPayoutMethod, type PayoutMethod } from "@/lib/db/users-payout";
import { cn } from "@/lib/utils";

/**
 * Decide which rail this diner is on, even if users.payout_method was
 * never set (existing diners who completed Dwolla before the chooser
 * shipped). Explicit choice wins; otherwise we infer from whichever
 * provider has live setup state.
 */
function inferMethod(args: {
  explicit: PayoutMethod | null;
  hasAstraCard: boolean;
  hasDwollaDestination: boolean;
}): PayoutMethod | null {
  if (args.explicit) return args.explicit;
  if (args.hasAstraCard) return "astra";
  if (args.hasDwollaDestination) return "dwolla";
  return null;
}

export default async function CashBackSetupPage() {
  const profile = await requireRole("diner");
  const debitEnabled = process.env.ASTRA_DEBIT_ENABLED === "true";

  const [explicit, astraAccount, dwollaAccount] = await Promise.all([
    getPayoutMethod(profile.id),
    getDinerAstraAccount(profile.id),
    getDinerDwollaAccount(profile.id),
  ]);

  const method = inferMethod({
    explicit,
    hasAstraCard: !!astraAccount?.cardId,
    hasDwollaDestination: !!dwollaAccount?.defaultCardFundingSourceUrl,
  });

  // Already set up — show a summary, not the chooser.
  if (method === "astra" && astraAccount?.cardId) {
    return <ActiveSummary kind="astra" mask={astraAccount.cardLast4} />;
  }
  if (method === "dwolla" && dwollaAccount?.defaultCardFundingSourceUrl) {
    return <ActiveSummary kind="dwolla" />;
  }

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Cash back</Eyebrow>
          <Heading as="h1" size="display">
            Where should your <em>cash back</em> land?
          </Heading>
          <p className="text-sm text-muted-foreground">
            Pick how you&apos;d like cash back paid out. You can switch
            later from Profile.
          </p>
        </div>

        {/* Debit option */}
        <OptionCard
          href="/app/rebates/setup/debit"
          icon={<Wallet className="size-5" strokeWidth={1.75} />}
          title="On your debit card"
          subtitle="Lands in minutes."
          badge={debitEnabled ? "Recommended" : "Coming soon"}
          disabled={!debitEnabled}
        />

        {/* ACH option */}
        <OptionCard
          href="/app/rebates/setup/ach"
          icon={<Building2 className="size-5" strokeWidth={1.75} />}
          title="In your bank account"
          subtitle="Deposits in 1–2 business days."
        />
      </div>
    </main>
  );
}

function OptionCard({
  href,
  icon,
  title,
  subtitle,
  badge,
  disabled = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  disabled?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-cream-warm text-ink">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {badge ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]",
            disabled
              ? "bg-cream-warm text-muted-foreground"
              : "bg-sage/15 text-sage",
          )}
        >
          {badge}
        </span>
      ) : (
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground"
          strokeWidth={1.75}
        />
      )}
    </div>
  );

  if (disabled) {
    return (
      <Card className="cursor-not-allowed opacity-60">{inner}</Card>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border bg-white p-5 transition-colors hover:border-orange"
    >
      {inner}
    </Link>
  );
}

function ActiveSummary({
  kind,
  mask,
}: {
  kind: PayoutMethod;
  mask?: string | null;
}) {
  const debitEnabled = process.env.ASTRA_DEBIT_ENABLED === "true";
  const isAstra = kind === "astra";
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Cash back</Eyebrow>
          <Heading as="h1" size="display">
            Your <em>payout</em> is set.
          </Heading>
        </div>

        <Card className="space-y-1.5 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-sage">
            {isAstra ? "Debit card" : "Bank account"}
          </p>
          <p className="text-foreground/80">
            {isAstra ? (
              <>
                Cash back goes to your debit card
                {mask ? (
                  <>
                    {" "}
                    <span className="font-mono">···· {mask}</span>
                  </>
                ) : null}{" "}
                — arrives in minutes.
              </>
            ) : (
              <>
                Cash back deposits into your linked checking account in
                1–2 business days.
              </>
            )}
          </p>
        </Card>

        <div className="space-y-2">
          <Link
            href={isAstra ? "/app/rebates/setup/debit" : "/app/rebates/setup/ach"}
            className={buttonVariants({
              variant: "ghost",
              size: "md",
              className: "w-full",
            })}
          >
            Manage {isAstra ? "card" : "bank account"}
          </Link>
          {/* Offer to switch — only show the other rail if it's available. */}
          {isAstra ? (
            <Link
              href="/app/rebates/setup/ach"
              className="block text-center text-xs text-muted-foreground underline underline-offset-4"
            >
              Switch to a bank account instead
            </Link>
          ) : debitEnabled ? (
            <Link
              href="/app/rebates/setup/debit"
              className="block text-center text-xs text-muted-foreground underline underline-offset-4"
            >
              Switch to a debit card instead
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
