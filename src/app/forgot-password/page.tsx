// Forgot-password page. Step 1 of the reset flow: collect an email and
// send a recovery link (→ /auth/confirm-reset → /reset-password).
//
// Server Component. Mirrors the sign-in page layout. The "check your
// email" confirmation and any error come back via searchParams.

import Link from "next/link";

import { Button, Card, Heading, Wordmark } from "@/components/brand";
import { requestPasswordReset } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  email?: string;
}>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { error, sent, email } = params;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <Heading as="h1" size="page" className="pb-0">
            Reset your password
          </Heading>
        </div>

        {sent ? (
          <Card className="border-paprika/30 bg-paprika-tint text-sm text-ink/80">
            If an account exists for{" "}
            <strong className="text-ink">{email ?? "that address"}</strong>,
            we&apos;ve sent a link to reset your password. Click the link in the
            email to continue — you can close this tab.
          </Card>
        ) : (
          <Card>
            <form action={requestPasswordReset} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  className={inputClass}
                />
                <span className="text-xs text-muted-foreground">
                  We&apos;ll email you a link to set a new password.
                </span>
              </label>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full">
                Send reset link
              </Button>
            </form>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className="text-paprika underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
