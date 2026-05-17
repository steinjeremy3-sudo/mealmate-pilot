// Sign-in page. Email-first. Password optional — if filled, we use
// password auth; otherwise we send a magic link.
//
// Server Component. Errors and the "check your email" confirmation come
// back via searchParams.

import Link from "next/link";

import { signIn } from "@/app/auth/actions";

type SearchParams = Promise<{ error?: string; sent?: string; email?: string }>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = params.error;
  const sent = params.sent;
  const sentEmail = params.email;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            MealMate
          </p>
          <h1 className="font-serif text-3xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Restaurant operators and ops team. Diners use the mobile app.
          </p>
        </div>

        {sent ? (
          <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm">
            We sent a sign-in link to{" "}
            <strong>{sentEmail ?? "your inbox"}</strong>. Click the link in the
            email to finish signing in. You can close this tab.
          </div>
        ) : (
          <form action={signIn} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Password{" "}
                <span className="text-muted-foreground font-normal">
                  (optional — leave blank to get a magic link)
                </span>
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/sign-up" className="underline underline-offset-4">
            Create a merchant account
          </Link>
        </p>
      </div>
    </main>
  );
}
