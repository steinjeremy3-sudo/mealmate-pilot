// Diner profile — account info + the account-level surfaces (linked
// cards, rebate destination) + sign out.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DinerProfilePage() {
  const profile = await requireRole("diner");

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5">
          <Eyebrow>Profile</Eyebrow>
          <Heading as="h1" size="display">
            {profile.displayName}
          </Heading>
        </div>

        <Card className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Account
          </p>
          <p className="text-sm">{profile.email ?? "no email on file"}</p>
        </Card>

        <ul className="space-y-2">
          <li>
            <Link href="/app/cards" className="block">
              <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-bone-deep">
                <div>
                  <p className="font-medium">Linked cards</p>
                  <p className="text-xs text-muted-foreground">
                    The cards we watch for restaurant visits
                  </p>
                </div>
                <span className="text-muted-foreground">→</span>
              </Card>
            </Link>
          </li>
          <li>
            <Link href="/app/rebates/setup" className="block">
              <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-bone-deep">
                <div>
                  <p className="font-medium">Cash-back destination</p>
                  <p className="text-xs text-muted-foreground">
                    Where your cash back lands
                  </p>
                </div>
                <span className="text-muted-foreground">→</span>
              </Card>
            </Link>
          </li>
          <li>
            <Link href="/app/profile/preferences" className="block">
              <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-bone-deep">
                <div>
                  <p className="font-medium">Your tastes</p>
                  <p className="text-xs text-muted-foreground">
                    Cuisines we&apos;ll feature on your home screen
                  </p>
                </div>
                <span className="text-muted-foreground">→</span>
              </Card>
            </Link>
          </li>
          <li>
            <Link href="/app/profile/help" className="block">
              <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-bone-deep">
                <div>
                  <p className="font-medium">Help</p>
                  <p className="text-xs text-muted-foreground">
                    How Mealmate works, answered
                  </p>
                </div>
                <span className="text-muted-foreground">→</span>
              </Card>
            </Link>
          </li>
        </ul>

        <div className="border-t border-border pt-4">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
