// Merchant "tonight" view — every claim made today against any of the
// merchant's offers. Useful during service so the host knows who's
// coming in and which offer they claimed.

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
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
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";
  if (active) {
    return (
      <span className={`${base} border-ink/15 bg-bone-deep text-ink`}>
        active
      </span>
    );
  }
  const label =
    status === "claimed"
      ? "expired"
      : status === "matched" || status === "consumed"
        ? "confirmed"
        : status;
  const tone =
    label === "confirmed"
      ? "border-paprika/30 bg-paprika-tint text-paprika-deep"
      : "border-border bg-bone-deep text-muted-foreground";
  return <span className={`${base} ${tone}`}>{label}</span>;
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
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Tonight</Eyebrow>
          <Heading as="h1" size="page">
            {active.length === 0 && paid.length === 0 ? (
              "No activity yet"
            ) : (
              <>
                <em>{active.length}</em> holding · {paid.length} paid
              </>
            )}
          </Heading>
          <p className="text-sm text-muted-foreground">
            Offers your diners activated today, newest last.
          </p>
        </div>

        {claims.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No activity today. Diners show up here as soon as they
            activate one of your live offers.
          </Card>
        ) : (
          <Card flush className="divide-y divide-border overflow-hidden">
            {claims.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-4 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">
                    {c.diner?.display_name ?? "Unknown diner"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.offer?.title ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Activated at {formatTime(c.claimed_at)}
                  </p>
                </div>
                <StatusBadge status={c.status} active={isClaimActive(c)} />
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
