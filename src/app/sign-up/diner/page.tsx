// Diner-only sign-up. The bare /sign-up route still exists as a
// chooser landing for anyone arriving without a role; this page is
// what the marketing-site "Get started" CTA points at.

import Link from "next/link";

import { Card, Heading, Wordmark } from "@/components/brand";
import { SignUpForm } from "../SignUpForm";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  email?: string;
  method?: string;
}>;

export default async function DinerSignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent, email, method } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <Heading as="h1" size="page" className="pb-0">
            Get started
          </Heading>
          <p className="text-sm text-muted-foreground">
            Free. Link a card and cash back lands automatically when
            you visit a Mealmate restaurant.
          </p>
        </div>

        {sent ? (
          <Card className="border-paprika/30 bg-paprika-tint text-sm text-ink/80">
            We sent a confirmation link to{" "}
            <strong className="text-ink">{email ?? "your inbox"}</strong>.
            Click it to finish creating your account.
          </Card>
        ) : (
          <SignUpForm
            role="diner"
            submitLabel="Sign up free"
            error={error}
            allowPhone
            initialMethod={method === "phone" ? "phone" : "email"}
          />
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-paprika underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
