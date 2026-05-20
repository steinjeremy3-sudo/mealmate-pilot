// Admin audit-log viewer (A3). The full append-only event trail,
// filterable by subject type / subject id / action.

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getAuditLogEntries } from "@/lib/db/audit-log-read";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const inputClass =
  "rounded-lg border border-border bg-cream-soft px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string; action?: string }>;
}) {
  await requireRole("admin");
  const { type, id, action } = await searchParams;

  const entries = await getAuditLogEntries({
    subjectType: type || undefined,
    subjectId: id || undefined,
    action: action || undefined,
  });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Audit log</Eyebrow>
          <Heading as="h1" size="page">
            Event trail
          </Heading>
          <p className="text-sm text-muted-foreground">
            Append-only. Filter by a subject (e.g. type{" "}
            <code className="font-mono text-foreground">restaurant</code>,{" "}
            <code className="font-mono text-foreground">rebate</code>,{" "}
            <code className="font-mono text-foreground">
              matched_transaction
            </code>
            ) and its id.
          </p>
        </div>

        {/* Filter — a plain GET form so filters live in the URL. */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Subject type</span>
            <input
              type="text"
              name="type"
              defaultValue={type ?? ""}
              placeholder="rebate"
              className={`${inputClass} block w-44`}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Subject id</span>
            <input
              type="text"
              name="id"
              defaultValue={id ?? ""}
              placeholder="uuid"
              className={`${inputClass} block w-72`}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Action</span>
            <input
              type="text"
              name="action"
              defaultValue={action ?? ""}
              placeholder="rebate.sent"
              className={`${inputClass} block w-48`}
            />
          </label>
          <button
            type="submit"
            className="rounded-full border border-border bg-transparent px-4 py-2 text-xs font-medium transition-colors hover:bg-cream-warm"
          >
            Filter
          </button>
        </form>

        {entries.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No audit entries match.
          </Card>
        ) : (
          <Card flush className="divide-y divide-border overflow-hidden">
            {entries.map((e) => (
              <div key={e.id} className="space-y-1 p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-mono text-sm text-foreground">
                    {e.action}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatWhen(e.createdAt)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {e.actorRole}
                  {e.actorUserId ? ` · ${e.actorUserId}` : ""} →{" "}
                  {e.subjectType} {e.subjectId}
                </p>
                {e.metadata && Object.keys(e.metadata).length > 0 ? (
                  <pre className="overflow-x-auto rounded-md bg-cream-warm px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
