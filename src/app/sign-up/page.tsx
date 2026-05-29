// Sign-up landing — chooser for anyone arriving at the bare
// /sign-up URL without picking a role yet. The actual forms live at
// /sign-up/diner and /sign-up/merchant.
//
// Honors ?as=diner|merchant for backward compat with old CTAs that
// still pass the query param — redirects straight through.

import { redirect } from "next/navigation";
import Link from "next/link";

import { Card, Heading, Wordmark } from "@/components/brand";

type SearchParams = Promise<{ as?: string }>;

export default async function SignUpChooserPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { as } = await searchParams;
  if (as === "diner") redirect("/sign-up/diner");
  if (as === "merchant") redirect("/sign-up/merchant");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <Heading as="h1" size="page" className="pb-0">
            Sign up to Mealmate
          </Heading>
          <p className="text-sm text-muted-foreground">
            Two different paths — pick the one that&apos;s you.
          </p>
        </div>

        <div className="grid gap-3">
          <Link href="/sign-up/diner" className="block">
            <Card className="space-y-1.5 transition-colors hover:bg-bone-deep">
              <p className="font-display text-xl tracking-[-0.02em]">
                I&apos;m a diner →
              </p>
              <p className="text-sm text-muted-foreground">
                Browse offers, link a card, and get cash back at
                the restaurants you already love. Free.
              </p>
            </Card>
          </Link>

          <Link href="/sign-up/merchant" className="block">
            <Card className="space-y-1.5 transition-colors hover:bg-bone-deep">
              <p className="font-display text-xl tracking-[-0.02em]">
                I run a restaurant →
              </p>
              <p className="text-sm text-muted-foreground">
                Set discounts at slow hours, drive incremental
                covers, no platform fees. We review and approve
                within 24 hours.
              </p>
            </Card>
          </Link>
        </div>

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
