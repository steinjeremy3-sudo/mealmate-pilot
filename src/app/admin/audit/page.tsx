// Admin audit-log viewer (A3). The full append-only event trail,
// filterable by subject type / subject id / action.

import { Card } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
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
  "rounded-lg border border-border bg-bone px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";

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
    <>
      <PageHeader
        eyebrow="Audit log"
        title={
          <>
            Every action, <em>recorded.</em>
          </>
        }
        sub="Append-only. Diner activity, merchant edits, admin decisions, system jobs — filter by a subject and its id."
      />

      <div className="space-y-5 px-10 py-8">
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
            className="rounded-full border border-border bg-transparent px-4 py-2 text-xs font-medium transition-colors hover:bg-bone-deep"
          >
            Filter
          </button>
        </form>

        {entries.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No audit entries match.
          </Card>
        ) : (
          <Card flush className="overflow-hidden">
            {entries.map((e) => (
              <div
                key={e.id}
                className="space-y-1.5 border-b border-border p-4 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="rounded bg-paprika-tint px-2 py-0.5 font-mono text-[11px] text-paprika-deep">
                    {e.action}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatWhen(e.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {e.actorRole}
                  {e.actorUserId ? ` · ${e.actorUserId}` : ""} →{" "}
                  {e.subjectType}{" "}
                  <span className="font-mono">{e.subjectId}</span>
                </p>
                {e.metadata && Object.keys(e.metadata).length > 0 ? (
                  <pre className="overflow-x-auto rounded-md bg-bone-deep px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
