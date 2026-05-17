// Marketing landing (public). Phase 0 placeholder — the real landing arrives later.
//
// The three role-gated sections live at:
//   /app       → diner
//   /dashboard → merchant
//   /admin     → ops

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-xl w-full text-center space-y-6">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          MealMate · Dallas
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight">
          Restaurant discounts that cost restaurants nothing.
        </h1>
        <p className="text-base text-muted-foreground">
          Browse offers from independent Dallas restaurants. Claim one, eat,
          pay in the app, see the discount applied. The restaurant pays nothing.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2 text-sm">
          <Link href="/app" className="underline underline-offset-4">
            Diner
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/dashboard" className="underline underline-offset-4">
            Merchant
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/admin" className="underline underline-offset-4">
            Ops
          </Link>
        </div>
      </div>
    </main>
  );
}
