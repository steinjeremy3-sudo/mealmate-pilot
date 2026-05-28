// Admin / ops control room — approvals, match-review depth, rebate
// health, and a live activity feed. Everything here is real data.

import Link from "next/link";

import { Card, Eyebrow, PlaceholderImg } from "@/components/brand";
import { KpiCard } from "@/components/console/KpiCard";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import { getAuditLogEntries } from "@/lib/db/audit-log-read";
import {
  getPendingReviewMatches,
  type MatchConfidence,
} from "@/lib/db/matched-transactions";
import { getAllRebates } from "@/lib/db/rebates";
import { getPendingRestaurants } from "@/lib/db/restaurants";
import { centsToUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const CONFIDENCE: Record<MatchConfidence, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-bone-deep text-ink" },
  medium: { label: "Medium", cls: "bg-paprika/15 text-ink/80" },
  low: { label: "Low", cls: "bg-paprika-tint text-paprika-deep" },
  none: { label: "None", cls: "bg-bone-deep text-muted-foreground" },
};

function initialsOf(name: string | null | undefined): string {
  if (!name) return "·";
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "·"
  );
}

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminHome() {
  const profile = await requireRole("admin");
  const [pendingRestaurants, pendingMatches, rebates, audit] =
    await Promise.all([
      getPendingRestaurants(),
      getPendingReviewMatches(),
      getAllRebates(),
      getAuditLogEntries(),
    ]);

  const failedRebates = rebates.filter((r) => r.status === "failed").length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const volume7dCents = rebates
    .filter((r) => new Date(r.createdAt) >= weekAgo)
    .reduce((sum, r) => sum + r.amountCents, 0);

  const firstName = profile.displayName?.trim().split(/\s+/)[0] || "team";

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title={
          <>
            Control room
          </>
        }
        sub={`Morning, ${firstName}. Here's what needs a human today.`}
        actions={
          <Link
            href="/admin/matches"
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
          >
            Review queue ({pendingMatches.length})
          </Link>
        }
      />

      <div className="space-y-8 px-10 py-8">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Pending approvals"
            value={String(pendingRestaurants.length)}
          />
          <KpiCard
            label="Visits to review"
            value={String(pendingMatches.length)}
          />
          <KpiCard label="Failed cash back" value={String(failedRebates)} />
          <KpiCard
            label="Cash back · 7d"
            value={centsToUsd(volume7dCents)}
          />
        </div>

        {/* Alert — only when something needs attention */}
        {failedRebates > 0 ? (
          <Link href="/admin/rebates" className="block">
            <div className="flex items-center gap-3 rounded-xl border border-paprika/30 bg-paprika-tint px-5 py-3.5 text-sm text-paprika-deep transition-colors hover:bg-paprika/25">
              <span className="size-2 shrink-0 rounded-full bg-paprika" />
              <span className="flex-1">
                <strong className="font-semibold">
                  {failedRebates} cash-back payment
                  {failedRebates === 1 ? "" : "s"} failed to issue.
                </strong>{" "}
                Diners are owed money — resolve in the cash-back queue.
              </span>
              <span className="shrink-0 font-medium">Review →</span>
            </div>
          </Link>
        ) : null}

        {/* Restaurant approvals */}
        <section className="space-y-3">
          <Eyebrow>Restaurant approvals</Eyebrow>
          {pendingRestaurants.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted-foreground">
              No restaurants waiting for approval.
            </Card>
          ) : (
            <Card flush className="overflow-hidden">
              {pendingRestaurants.map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/restaurants/${r.id}`}
                  className="flex items-center gap-4 border-b border-border p-4 transition-colors last:border-b-0 hover:bg-bone-deep"
                >
                  <PlaceholderImg
                    name={r.name}
                    className="size-11 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.cuisine} · {r.neighborhood} ·{" "}
                      {r.owner?.display_name ?? "Unknown owner"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {dateTime(r.created_at)}
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </section>

        {/* Match queue + activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card flush className="overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div>
                <h2 className="font-display text-xl tracking-tight">
                  Visit review queue
                </h2>
                <p className="text-xs text-muted-foreground">
                  Below the 90% auto-approve line.
                </p>
              </div>
              <Link
                href="/admin/matches"
                className="shrink-0 text-sm font-medium text-paprika hover:text-paprika-deep"
              >
                Open queue →
              </Link>
            </div>
            {pendingMatches.length === 0 ? (
              <p className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
                Queue is empty — every visit auto-confirmed.
              </p>
            ) : (
              <ul className="border-t border-border">
                {pendingMatches.slice(0, 5).map((m) => {
                  const conf = CONFIDENCE[m.matchConfidence];
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/admin/matches/${m.id}`}
                        className="flex items-center gap-3 border-b border-border px-6 py-3.5 transition-colors last:border-b-0 hover:bg-bone-deep"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bone-deep font-mono text-[11px]">
                          {initialsOf(m.claim?.diner?.displayName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {m.restaurant?.name ?? m.merchantNameRaw}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {centsToUsd(m.amountCents)} · {m.transactionDate}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]",
                            conf.cls,
                          )}
                        >
                          {conf.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card flush className="overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <h2 className="font-display text-xl tracking-tight">
                Recent activity
              </h2>
              <Link
                href="/admin/audit"
                className="shrink-0 text-sm font-medium text-paprika hover:text-paprika-deep"
              >
                Full log →
              </Link>
            </div>
            {audit.length === 0 ? (
              <p className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            ) : (
              <ul className="border-t border-border">
                {audit.slice(0, 6).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 border-b border-border px-6 py-3 text-sm last:border-b-0"
                  >
                    <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">
                      {dateTime(e.createdAt)}
                    </span>
                    <span className="shrink-0 rounded bg-paprika-tint px-2 py-0.5 font-mono text-[10px] text-paprika-deep">
                      {e.action}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {e.subjectType}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
