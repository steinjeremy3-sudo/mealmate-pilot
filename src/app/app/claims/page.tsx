// Diner's claims list. Active (claimed + not yet expired) claims first,
// then the rest of the history.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import {
  expiresInMinutes,
  getClaimsForDiner,
  isClaimActive,
  type ClaimStatus,
} from "@/lib/db/claims";

import { cancelClaim } from "./actions";

function StatusBadge({
  status,
  active,
}: {
  status: ClaimStatus;
  active: boolean;
}) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";
  if (active) {
    return (
      <span className={`${base} border-sage/40 bg-sage-tint text-sage`}>
        active
      </span>
    );
  }
  // `claimed` past expiry reads as "expired"; matched/consumed as "redeemed".
  const label =
    status === "claimed"
      ? "expired"
      : status === "matched" || status === "consumed"
        ? "redeemed"
        : status;
  const tone =
    label === "redeemed"
      ? "border-orange/30 bg-orange-tint text-orange-deep"
      : "border-border bg-cream-warm text-muted-foreground";
  return <span className={`${base} ${tone}`}>{label}</span>;
}

export default async function DinerClaimsPage() {
  await requireRole("diner");
  const claims = await getClaimsForDiner();

  const active = claims.filter(isClaimActive);
  const past = claims.filter((c) => !isClaimActive(c));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Your claims</Eyebrow>
          <Heading as="h1" size="display">
            {active.length === 0 ? (
              "No active claims"
            ) : (
              <>
                <em>{active.length}</em> active
              </>
            )}
          </Heading>
        </div>

        {active.length > 0 && (
          <ul className="space-y-3">
            {active.map((c) => (
              <li key={c.id}>
                <Card flush className="border-sage/40 bg-sage-tint">
                  <Link
                    href={c.offer ? `/app/offers/${c.offer.id}` : "/app"}
                    className="block rounded-t-xl p-5 transition-colors hover:bg-sage-soft/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-serif text-lg font-medium tracking-tight text-ink">
                          {c.offer?.title ?? "Offer"}
                        </p>
                        <p className="truncate text-xs text-ink/70">
                          {c.offer?.restaurant?.name ?? "—"}
                        </p>
                      </div>
                      <StatusBadge status={c.status} active />
                    </div>
                    <p className="mt-3 border-t border-sage/30 pt-2 text-xs text-ink/70">
                      Expires in {expiresInMinutes(c)} min · pay with your
                      linked card to redeem
                    </p>
                  </Link>
                  <div className="border-t border-sage/30 p-3">
                    <form action={cancelClaim}>
                      <input type="hidden" name="claim_id" value={c.id} />
                      <button
                        type="submit"
                        className="w-full cursor-pointer rounded-full border border-sage/40 bg-cream-soft px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream-warm"
                      >
                        Cancel claim
                      </button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <div className="space-y-3">
            <Eyebrow tone="muted">History</Eyebrow>
            <ul className="space-y-2">
              {past.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/claims/${c.id}`} className="block">
                    <Card className="flex items-start justify-between gap-3 transition-colors hover:bg-cream-warm">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {c.offer?.title ?? "Offer"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.offer?.restaurant?.name ?? "—"} ·{" "}
                          {new Date(c.claimed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={c.status} active={false} />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {claims.length === 0 && (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            You haven&apos;t claimed any offers yet. Browse{" "}
            <Link
              href="/app"
              className="text-orange underline underline-offset-4"
            >
              live offers
            </Link>
            .
          </Card>
        )}
      </div>
    </main>
  );
}
