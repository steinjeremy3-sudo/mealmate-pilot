// Admin / ops home.
//
// Currently shows the restaurant approval queue. Phase 4 sub-phases
// will reintroduce richer dashboards:
//   - 4b/4c: unmatched / low-confidence transaction review queue
//   - 4d: rebate issuance status (Visa Direct push state machine)
//   - 4e: weekly settlement batches owed by restaurants
// The Phase 2e flagged-payments and Phase 3.5 payouts sections were
// removed when the in-app payment model was retired.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getPendingReviewMatches } from "@/lib/db/matched-transactions";
import { getPendingRestaurants } from "@/lib/db/restaurants";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminHome() {
  await requireRole("admin");
  const [pendingRestaurants, pendingMatches] = await Promise.all([
    getPendingRestaurants(),
    getPendingReviewMatches(),
  ]);

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-8">
        {/* ===== Restaurant approval queue ===== */}
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

        {/* ===== Plaid match review queue ===== */}
        <section className="space-y-3">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Plaid match review
            </p>
            <h2 className="font-serif text-2xl font-semibold">
              {pendingMatches.length === 0
                ? "Queue is empty"
                : `${pendingMatches.length} pending`}
            </h2>
          </div>
          <Link
            href="/admin/matches"
            className="inline-block text-sm underline underline-offset-4"
          >
            Open review queue →
          </Link>
        </section>

        {/* ===== Rebates ===== */}
        <section className="space-y-3">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Rebates · Dwolla
            </p>
            <h2 className="font-serif text-2xl font-semibold">
              Issuance status
            </h2>
          </div>
          <Link
            href="/admin/rebates"
            className="inline-block text-sm underline underline-offset-4"
          >
            Open rebates →
          </Link>
        </section>

        {/* ===== Phase 4e placeholder ===== */}
        <section className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
          Weekly settlement batches (Stripe Connect invoices to
          restaurants) will land here as Phase 4e ships.
        </section>
      </div>
    </main>
  );
}
