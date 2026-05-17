// /diner — landing for users with role=diner who somehow end up on the web.
// There's no functional diner experience here; the real product is the
// native iOS / Android app (mealmate-diner, TBD). This page just tells
// them to get the app and offers a sign-out so they don't get stuck.

import { signOut } from "@/app/auth/actions";

export default function DinerLanding() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          MealMate · Diner
        </p>
        <h1 className="font-serif text-3xl font-semibold">
          MealMate for diners lives on your phone.
        </h1>
        <p className="text-sm text-muted-foreground">
          Browsing offers, claiming, and paying all happen in the native iOS
          and Android app. The website is for restaurant operators and the
          MealMate team only.
        </p>
        <p className="text-sm text-muted-foreground">
          {/* TODO: replace with real App Store / Play Store URLs once the
              mealmate-diner Expo project ships its first build. */}
          App Store + Play Store links coming soon.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
