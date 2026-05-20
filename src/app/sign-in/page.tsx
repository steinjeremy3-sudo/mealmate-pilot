// Sign-in page. Email-first. Password optional — if filled, we use
// password auth; otherwise we send a magic link.
//
// Server Component. Errors and the "check your email" confirmation come
// back via searchParams.

import Link from "next/link";

import { Button, Card, Eyebrow, Heading } from "@/components/brand";
import { signIn } from "@/app/auth/actions";

type SearchParams = Promise<{ error?: string; sent?: string; email?: string }>;

const inputClass =
  "w-full rounded-lg border border-border bg-cream-soft px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange";

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
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <Eyebrow className="flex justify-center">MealMate</Eyebrow>
          <Heading as="h1" size="page">
            Sign in
          </Heading>
          <p className="text-sm text-muted-foreground">
            Diners, restaurants, and ops all sign in here.
          </p>
        </div>

        {sent ? (
          <Card className="border-sage/40 bg-sage-tint text-sm text-ink/80">
            We sent a sign-in link to{" "}
            <strong className="text-ink">{sentEmail ?? "your inbox"}</strong>.
            Click the link in the email to finish signing in — you can close
            this tab.
          </Card>
        ) : (
          <Card>
            <form action={signIn} className="space-y-4">
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
                    (optional — blank sends a magic link)
                  </span>
                </span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  className={inputClass}
                />
              </label>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/sign-up"
            className="text-orange underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
