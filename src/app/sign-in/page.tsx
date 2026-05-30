// Sign-in page. Offers Email or Phone (SignInForm). Email is password-
// optional (blank → magic link); phone texts a code (→ /verify-phone).
//
// Server Component. Errors and the "check your email" confirmation come
// back via searchParams; the form's tab is in SignInForm (client).

import Link from "next/link";

import { Card, Heading, Wordmark } from "@/components/brand";
import { SignInForm } from "./SignInForm";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  email?: string;
  method?: string;
}>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = params.error;
  const sent = params.sent;
  const sentEmail = params.email;
  const method = params.method === "phone" ? "phone" : "email";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <Heading as="h1" size="page" className="pb-0">
            Your favorite food, for less
          </Heading>
        </div>

        {sent ? (
          <Card className="border-paprika/30 bg-paprika-tint text-sm text-ink/80">
            We sent a sign-in link to{" "}
            <strong className="text-ink">{sentEmail ?? "your inbox"}</strong>.
            Click the link in the email to finish signing in — you can close
            this tab.
          </Card>
        ) : (
          <SignInForm error={error} initialMethod={method} />
        )}

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/sign-up"
            className="text-paprika underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
