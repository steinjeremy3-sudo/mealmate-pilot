// Step 2 of phone (SMS OTP) auth: enter the 6-digit code. Reached from
// startPhoneAuth, which texts the code and redirects here with the phone
// (E.164) and mode in the query string. Submitting verifies the code
// inline (verifyPhoneOtp) and lands the user on their role's home.
//
// Standalone page (not in the (public) group) — like /sign-in, it owns
// its own wordmark and centers a single card.

import Link from "next/link";

import { Button, Card, Heading, Wordmark } from "@/components/brand";
import { verifyPhoneOtp } from "@/app/auth/actions";
import { formatUsPhone } from "@/lib/auth/phone";

type SearchParams = Promise<{ phone?: string; mode?: string; error?: string }>;

const inputClass =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-center text-lg tracking-[0.4em] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const phone = params.phone ?? "";
  const mode = params.mode === "signup" ? "signup" : "signin";
  const error = params.error;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <Heading as="h1" size="page" className="pb-0">
            Enter your code
          </Heading>
          <p className="text-sm text-muted-foreground">
            We texted a 6-digit code to{" "}
            <strong className="text-ink">
              {phone ? formatUsPhone(phone) : "your phone"}
            </strong>
            .
          </p>
        </div>

        <Card>
          <form action={verifyPhoneOtp} className="space-y-4">
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="mode" value={mode} />

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">6-digit code</span>
              <input
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                placeholder="••••••"
                className={inputClass}
              />
            </label>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full">
              Verify &amp; continue
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t get it?{" "}
          <Link
            href={mode === "signup" ? "/sign-up/diner" : "/sign-in"}
            className="text-paprika underline underline-offset-4"
          >
            Start over
          </Link>
        </p>
      </div>
    </main>
  );
}
