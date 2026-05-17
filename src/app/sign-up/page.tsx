// Sign-up page. Single form with a role toggle — Diner or Restaurant
// operator (merchant). Admin accounts are created by hand in the
// Supabase dashboard, not via this form.
//
// Pre-select the role with `?as=diner` or `?as=merchant` (set by the
// marketing landing's CTAs). Default = `diner`.
//
// Server Component. Errors and "check your email" confirmations come
// back through searchParams.

import Link from "next/link";

import { signUp } from "@/app/auth/actions";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  email?: string;
  as?: string;
}>;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = params.error;
  const sent = params.sent;
  const sentEmail = params.email;
  const preselected = params.as === "merchant" ? "merchant" : "diner";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            MealMate
          </p>
          <h1 className="font-serif text-3xl font-semibold">Create account</h1>
          <p className="text-sm text-muted-foreground">
            Sign up as a diner to claim offers, or as a restaurant operator
            to list yours.
          </p>
        </div>

        {sent ? (
          <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm">
            We sent a confirmation link to{" "}
            <strong>{sentEmail ?? "your inbox"}</strong>. Click it to finish
            creating your account.
          </div>
        ) : (
          <form action={signUp} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">I&apos;m signing up as a…</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer has-checked:border-primary has-checked:bg-secondary/40">
                  <input
                    type="radio"
                    name="role"
                    value="diner"
                    defaultChecked={preselected === "diner"}
                    className="accent-primary"
                  />
                  Diner
                </label>
                <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer has-checked:border-primary has-checked:bg-secondary/40">
                  <input
                    type="radio"
                    name="role"
                    value="merchant"
                    defaultChecked={preselected === "merchant"}
                    className="accent-primary"
                  />
                  Restaurant operator
                </label>
              </div>
            </fieldset>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Your name</span>
              <input
                type="text"
                name="display_name"
                required
                autoComplete="name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

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
                  (optional — leave blank to use magic links)
                </span>
              </span>
              <input
                type="password"
                name="password"
                minLength={8}
                autoComplete="new-password"
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
              Create account
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have one?{" "}
          <Link href="/sign-in" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
