// Diner's claims list. Shows active (claimed + not yet expired) claims
// first, then the rest of the history grouped by status.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import {
  expiresInMinutes,
  getClaimsForDiner,
  isClaimActive,
  type ClaimStatus,
} from "@/lib/db/claims";

import { cancelClaim } from "./actions";

function StatusBadge({ status, active }: { status: ClaimStatus; active: boolean }) {
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
  // A `claimed` row that didn't pass isClaimActive must be past-expiry.
  const label = status === "claimed" ? "expired" : status;
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

export default async function DinerClaimsPage() {
  await requireRole("diner");
  const claims = await getClaimsForDiner();

  const active = claims.filter(isClaimActive);
  const past = claims.filter((c) => !isClaimActive(c));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Your claims
          </p>
          <h1 className="font-serif text-2xl font-semibold">
            {active.length === 0 ? "No active claims" : `${active.length} active`}
          </h1>
        </div>

        {active.length > 0 && (
          <ul className="space-y-3">
            {active.map((c) => (
              <li key={c.id} className="rounded-lg border border-emerald-200 bg-emerald-50">
                <Link
                  href={c.offer ? `/app/offers/${c.offer.id}` : "/app"}
                  className="block p-4 hover:bg-emerald-100 rounded-t-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-emerald-900 truncate">
                        {c.offer?.title ?? "Offer"}
                      </p>
                      <p className="text-xs text-emerald-800 truncate">
                        {c.offer?.restaurant?.name ?? "—"}
                      </p>
                    </div>
                    <StatusBadge status={c.status} active />
                  </div>
                  <p className="text-xs text-emerald-700 pt-2 border-t border-emerald-200 mt-3">
                    Expires in {expiresInMinutes(c)} min · show this at the
                    restaurant
                  </p>
                </Link>
                <div className="border-t border-emerald-200 p-3 flex gap-2">
                  <Link
                    href={`/app/claims/${c.id}/pay`}
                    className="flex-1 rounded-md bg-emerald-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    Pay
                  </Link>
                  <form action={cancelClaim}>
                    <input type="hidden" name="claim_id" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              History
            </h2>
            <ul className="space-y-2">
              {past.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/app/claims/${c.id}`}
                    className="flex items-start justify-between gap-3 rounded-md border border-border p-3 hover:bg-secondary/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.offer?.title ?? "Offer"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.offer?.restaurant?.name ?? "—"} ·{" "}
                        {new Date(c.claimed_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={c.status} active={false} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {claims.length === 0 && (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            You haven&apos;t claimed any offers yet. Browse{" "}
            <Link href="/app" className="underline underline-offset-4">
              live offers
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
