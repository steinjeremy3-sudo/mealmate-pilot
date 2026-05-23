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

import { Button, Card, Heading, Wordmark } from "@/components/brand";
import { signUp } from "@/app/auth/actions";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  email?: string;
  as?: string;
}>;

const inputClass =
  "w-full rounded-lg border border-border bg-cream-soft px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange";

const roleClass =
  "flex cursor-pointer items-center gap-2 rounded-lg border border-border " +
  "bg-cream-soft px-3 py-2 text-sm has-checked:border-orange " +
  "has-checked:bg-orange-tint";

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
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <Heading as="h1" size="page" className="pb-0">
            Create account
          </Heading>
          <p className="text-sm text-muted-foreground">
            Sign up as a diner to activate offers, or as a restaurant
            operator to list yours.
          </p>
        </div>

        {sent ? (
          <Card className="border-orange/30 bg-orange-tint text-sm text-ink/80">
            We sent a confirmation link to{" "}
            <strong className="text-ink">{sentEmail ?? "your inbox"}</strong>.
            Click it to finish creating your account.
          </Card>
        ) : (
          <Card>
            <form action={signUp} className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  I&apos;m signing up as a…
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className={roleClass}>
                    <input
                      type="radio"
                      name="role"
                      value="diner"
                      defaultChecked={preselected === "diner"}
                      className="accent-orange"
                    />
                    Diner
                  </label>
                  <label className={roleClass}>
                    <input
                      type="radio"
                      name="role"
                      value="merchant"
                      defaultChecked={preselected === "merchant"}
                      className="accent-orange"
                    />
                    Restaurant
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
                  className={inputClass}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Password{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional — blank uses magic links)
                  </span>
                </span>
                <input
                  type="password"
                  name="password"
                  minLength={8}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </label>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full">
                Create account
              </Button>
            </form>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have one?{" "}
          <Link
            href="/sign-in"
            className="text-orange underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
