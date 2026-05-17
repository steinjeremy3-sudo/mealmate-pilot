// Diner section layout (/app).
//
// In Phase 1 this layout will enforce role=diner via Supabase auth and
// redirect signed-in merchants/admins to their own sections. For Phase 0
// it's just a visual shell.

import Link from "next/link";

export default function DinerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-mono text-xs tracking-widest uppercase">
            MealMate · Diner
          </Link>
        </div>
      </header>
      <div className="flex-1 flex">{children}</div>
    </div>
  );
}
