// Diner section layout (/app).
//
// Mobile-first phone-width column with a fixed 5-tab bottom nav —
// the consumer prototype's app shell. Phase 1: enforces role=diner.
//
// Visual reference: design-reference/consumer.html.

import { requireRole } from "@/lib/auth/require-role";

import { DinerBottomNav } from "./DinerBottomNav";

export default async function DinerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("diner");

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* pb clears the fixed bottom nav. */}
      <div className="flex flex-1 flex-col pb-24">{children}</div>
      <DinerBottomNav />
    </div>
  );
}
