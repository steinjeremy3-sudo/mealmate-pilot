// Admin: every diner account.

import { Card } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import { getAllDiners, type DinerStatus } from "@/lib/db/diners";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<DinerStatus, string> = {
  active: "border-sage/40 bg-sage-tint text-sage",
  suspended: "border-amber/50 bg-amber/15 text-ink/80",
  deleted: "border-border bg-cream-warm text-muted-foreground",
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminDinersPage() {
  await requireRole("admin");
  const diners = await getAllDiners();

  return (
    <>
      <PageHeader
        eyebrow="Diners"
        title={
          <>
            {diners.length}{" "}
            <em>member{diners.length === 1 ? "" : "s"}.</em>
          </>
        }
        sub="Everyone who's signed up to dine with MealMate."
      />

      <div className="px-10 py-8">
        {diners.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No diners have signed up yet.
          </Card>
        ) : (
          <Card flush className="overflow-hidden">
            <div className="flex items-center gap-4 border-b border-border px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              <span className="flex-1">Diner</span>
              <span className="w-72">Email</span>
              <span className="w-28">Joined</span>
              <span className="w-24">Status</span>
            </div>
            {diners.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate font-serif text-base">
                  {d.displayName}
                </span>
                <span className="w-72 truncate text-sm text-muted-foreground">
                  {d.email ?? "—"}
                </span>
                <span className="w-28 font-mono text-xs text-muted-foreground">
                  {shortDate(d.createdAt)}
                </span>
                <span className="w-24">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]",
                      STATUS_TONE[d.status],
                    )}
                  >
                    {d.status}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
