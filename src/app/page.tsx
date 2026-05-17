// Marketing landing (public). Phase 0/1 placeholder — fuller landing arrives later.
//
// Role surfaces:
//   /app       → diner (claim offers)
//   /dashboard → merchant (list offers, manage restaurant)
//   /admin     → ops (approvals, fraud review)

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
        <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up?as=diner"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start as a diner
          </Link>
          <Link
            href="/sign-up?as=merchant"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            List your restaurant
          </Link>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Already have an account?{" "}
          <Link href="/sign-in" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
