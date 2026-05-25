// Diner cuisine preferences — pick the cuisines you love; they drive
// the "For you" section on the home feed.

import Link from "next/link";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import {
  getCuisineOptions,
  getDinerCuisines,
} from "@/lib/db/diner-preferences";

import { PreferencesForm } from "./PreferencesForm";

export default async function PreferencesPage() {
  const profile = await requireRole("diner");
  const [options, selected] = await Promise.all([
    getCuisineOptions(),
    getDinerCuisines(profile.id),
  ]);

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/app/profile"
          className="text-sm text-muted-foreground transition-colors hover:text-paprika"
        >
          ← Profile
        </Link>

        <div className="space-y-1.5">
          <Eyebrow>Preferences</Eyebrow>
          <Heading as="h1" size="display">
            Your tastes
          </Heading>
          <p className="text-sm text-muted-foreground">
            Pick the cuisines you love. We&apos;ll surface them in a
            &ldquo;For you&rdquo; section on your home screen.
          </p>
        </div>

        {options.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            No cuisines to choose from yet.
          </Card>
        ) : (
          <PreferencesForm options={options} selected={selected} />
        )}
      </div>
    </main>
  );
}
