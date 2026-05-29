// Merchant-only sign-up. After confirming email, the merchant lands
// at /dashboard/onboarding to enter restaurant details + start the
// Stripe Connect flow. Approval is a separate admin step.

import Link from "next/link";

import { Card, Heading, Wordmark } from "@/components/brand";
import { SignUpForm } from "../SignUpForm";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  email?: string;
}>;

export default async function MerchantSignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent, email } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <Heading as="h1" size="page" className="pb-0">
            List your restaurant
          </Heading>
          <p className="text-sm text-muted-foreground">
            Tell us a bit about you. After you confirm your email
            you&apos;ll add restaurant details and connect Stripe;
            we&apos;ll review and approve within 24 hours.
          </p>
        </div>

        {sent ? (
          <Card className="border-paprika/30 bg-paprika-tint text-sm text-ink/80">
            We sent a confirmation link to{" "}
            <strong className="text-ink">{email ?? "your inbox"}</strong>.
            Click it to finish signing up, then you&apos;ll land on
            the restaurant-onboarding flow.
          </Card>
        ) : (
          <SignUpForm
            role="merchant"
            nameLabel="Your name"
            submitLabel="Apply to list"
            error={error}
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
