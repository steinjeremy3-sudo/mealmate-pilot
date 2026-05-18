// Admin / ops home. Phase 2a: list of restaurants waiting for approval.
//
// Future sections (Phase 2d+): flagged payments, fraud signals, audit log.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { getPendingRestaurants } from "@/lib/db/restaurants";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminHome() {
  await requireRole("admin");
  const pending = await getPendingRestaurants();

  return (
    <main className="flex flex-1 items-start justify-center px-6 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div>
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Restaurant approvals
          </p>
          <h1 className="font-serif text-3xl font-semibold">
            {pending.length === 0
              ? "All caught up."
              : `${pending.length} pending`}
          </h1>
          <p className="text-sm text-muted-foreground">
            New merchants who&apos;ve submitted a restaurant and are waiting
            for approval.
          </p>
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            No restaurants waiting. When a merchant submits one, it&apos;ll
            show up here.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {pending.map((r) => (
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
      </div>
    </main>
  );
}
