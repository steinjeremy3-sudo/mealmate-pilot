// Merchant "tonight" view — every claim made today against any of the
// merchant's offers. Useful during service so the host knows who's coming
// in and which offer they claimed.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import {
  getTodaysClaimsForMerchant,
  isClaimActive,
  type ClaimStatus,
} from "@/lib/db/claims";

function StatusBadge({
  status,
  active,
}: {
  status: ClaimStatus;
  active: boolean;
}) {
  if (active) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
        active
      </span>
    );
  }
  const styles: Record<ClaimStatus, string> = {
    claimed: "bg-neutral-100 text-neutral-500 border-neutral-200",
    consumed: "bg-sky-100 text-sky-900 border-sky-200",
    expired: "bg-neutral-100 text-neutral-500 border-neutral-200",
    cancelled: "bg-neutral-100 text-neutral-500 border-neutral-200",
  };
  const label =
    status === "claimed" ? "expired" : status === "consumed" ? "paid" : status;
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        styles[status]
      }
    >
      {label}
    </span>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function MerchantTonightPage() {
  await requireRole("merchant");
  const claims = await getTodaysClaimsForMerchant();

  const active = claims.filter(isClaimActive);
  const paid = claims.filter((c) => c.status === "consumed");

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div>
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Tonight
          </p>
          <h1 className="font-serif text-3xl font-semibold">
            {active.length === 0 && paid.length === 0
              ? "No claims yet"
              : `${active.length} holding · ${paid.length} paid`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Claims your diners made today, in the order they were claimed.
          </p>
        </div>

        {claims.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            No claims today. They&apos;ll show up here as soon as a diner taps
            Claim on one of your live offers.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {claims.map((c) => {
              const isActive = isClaimActive(c);
              return (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-4 p-4"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium truncate">
                      {c.diner?.display_name ?? "Unknown diner"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.offer?.title ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Claimed at {formatTime(c.claimed_at)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} active={isActive} />
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          ← Back to dashboard
        </Link>
      </div>
    </main>
  );
}
