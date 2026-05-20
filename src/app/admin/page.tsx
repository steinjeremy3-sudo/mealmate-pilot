// Admin / ops home — restaurant approval queue + quick links into the
// match review, rebate, and settlement sections.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getPendingReviewMatches } from "@/lib/db/matched-transactions";
import { getPendingRestaurants } from "@/lib/db/restaurants";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SectionLink({
  href,
  eyebrow,
  title,
  hint,
}: {
  href: string;
  eyebrow: string;
  title: string;
  hint: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full space-y-1 transition-colors hover:bg-cream-warm">
        <Eyebrow>{eyebrow}</Eyebrow>
        <p className="font-serif text-lg font-medium tracking-tight">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </Card>
    </Link>
  );
}

export default async function AdminHome() {
  await requireRole("admin");
  const [pendingRestaurants, pendingMatches] = await Promise.all([
    getPendingRestaurants(),
    getPendingReviewMatches(),
  ]);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-1.5">
          <Eyebrow>Ops</Eyebrow>
          <Heading as="h1" size="page">
            Control room
          </Heading>
        </div>

        {/* ===== Restaurant approval queue ===== */}
        <section className="space-y-3">
          <div className="space-y-1">
            <Eyebrow>Restaurant approvals</Eyebrow>
            <Heading size="section">
              {pendingRestaurants.length === 0 ? (
                "All caught up"
              ) : (
                <>
                  <em>{pendingRestaurants.length}</em> pending
                </>
              )}
            </Heading>
          </div>

          {pendingRestaurants.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted-foreground">
              No restaurants waiting.
            </Card>
          ) : (
            <Card flush className="divide-y divide-border overflow-hidden">
              {pendingRestaurants.map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/restaurants/${r.id}`}
                  className="flex items-start justify-between gap-4 p-4 transition-colors hover:bg-cream-warm"
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
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    submitted {formatDate(r.created_at)}
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </section>

        {/* ===== Section links ===== */}
        <section className="grid gap-3 sm:grid-cols-3">
          <SectionLink
            href="/admin/matches"
            eyebrow="Plaid matches"
            title={
              pendingMatches.length === 0
                ? "Queue empty"
                : `${pendingMatches.length} to review`
            }
            hint="Medium / low confidence + flagged matches"
          />
          <SectionLink
            href="/admin/rebates"
            eyebrow="Rebates · Dwolla"
            title="Issuance status"
            hint="Cash-back pushed to diners"
          />
          <SectionLink
            href="/admin/settlements"
            eyebrow="Settlements"
            title="Restaurant invoicing"
            hint="Weekly Stripe invoices"
          />
        </section>
      </div>
    </div>
  );
}
