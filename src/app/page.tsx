// Marketing landing (public). Phase 0 placeholder — the real landing arrives later.
//
// Role surfaces:
//   /dashboard → merchant (this repo)
//   /admin     → ops (this repo)
//   diner      → native iOS/Android app (separate `mealmate-diner` repo, TBD)

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
        <p className="text-sm text-muted-foreground">
          The diner app is coming to iOS and Android. For now, restaurant
          operators and the MealMate ops team sign in below.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2 text-sm">
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
