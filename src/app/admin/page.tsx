// Admin / ops home. Two queues: pending restaurants (Phase 2a) and
// flagged payments (Phase 2e). Both are RLS-scoped to admins.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getPendingRestaurants } from "@/lib/db/restaurants";
import { getFlaggedPayments, getPendingPayoutsByRestaurant } from "@/lib/db/payments";
import { centsToUsd } from "@/lib/money";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminHome() {
  await requireRole("admin");
  const [pendingRestaurants, flaggedPayments, pendingPayouts] = await Promise.all([
    getPendingRestaurants(),
    getFlaggedPayments(),
    getPendingPayoutsByRestaurant(),
  ]);
  const pendingPayoutTotalCents = pendingPayouts.reduce(
    (sum, r) => sum + r.totalCents,
    0,
  );

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-8">
        {/* ===== Pending payouts (Phase 3.5) ===== */}
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
                Pending payouts
              </p>
              <h2 className="font-serif text-2xl font-semibold">
                {pendingPayouts.length === 0
                  ? "Nothing pending"
                  : `${centsToUsd(pendingPayoutTotalCents)} across ${pendingPayouts.length} restaurant${pendingPayouts.length === 1 ? "" : "s"}`}
              </h2>
            </div>
            {pendingPayouts.length > 0 ? (
              <Link
                href="/admin/payouts"
                className="text-sm underline underline-offset-4 shrink-0 self-start"
              >
                Pay out →
              </Link>
            ) : null}
          </div>
        </section>
        {/* ===== Flagged payments queue (Phase 2e) ===== */}
        <section className="space-y-3">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Flagged payments
            </p>
            <h2 className="font-serif text-2xl font-semibold">
              {flaggedPayments.length === 0
                ? "None to review"
                : `${flaggedPayments.length} to review`}
            </h2>
            <p className="text-sm text-muted-foreground">
              Payments where one or more rubric checks failed. The card was
              still charged — review approves or rejects.
            </p>
          </div>

          {flaggedPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
              All payments auto-approving.
            </p>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-md">
              {flaggedPayments.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/payments/${p.id}`}
                    className="flex items-start justify-between gap-4 p-4 hover:bg-secondary/40"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium truncate">
                        {p.claim?.offer?.restaurant?.name ?? "—"} ·{" "}
                        {centsToUsd(p.total_cents)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.claim?.diner?.display_name ?? "Unknown"} ·{" "}
                        {p.claim?.offer?.title ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Flagged: {(p.flagged_reasons ?? []).join(", ") || "—"}
                      </p>
                    </div>
                    <span className="text-right text-xs text-muted-foreground shrink-0">
                      {formatDate(p.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ===== Restaurant approval queue (Phase 2a) ===== */}
        <section className="space-y-3">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Restaurant approvals
            </p>
            <h2 className="font-serif text-2xl font-semibold">
              {pendingRestaurants.length === 0
                ? "All caught up"
                : `${pendingRestaurants.length} pending`}
            </h2>
          </div>

          {pendingRestaurants.length === 0 ? (
            <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
              No restaurants waiting.
            </p>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-md">
              {pendingRestaurants.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/restaurants/${r.id}`}
                    className="flex items-start justify-between gap-4 p-4 hover:bg-secondary/40"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.cuisine} · {r.neighborhood}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.owner?.display_name ?? "Unknown owner"} ·{" "}
                        {r.owner?.email ?? "no email"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      submitted {formatDate(r.created_at)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
