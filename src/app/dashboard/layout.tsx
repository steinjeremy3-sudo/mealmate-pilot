// Merchant section layout (/dashboard).
//
// In Phase 1 this enforces role=merchant via Supabase auth.

import Link from "next/link";

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-mono text-xs tracking-widest uppercase">
            MealMate · Merchant
          </Link>
        </div>
      </header>
      <div className="flex-1 flex">{children}</div>
    </div>
  );
}
