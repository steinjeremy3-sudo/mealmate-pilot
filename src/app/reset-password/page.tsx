// Reset-password page. Step 2 of the reset flow: the user arrives here
// with a recovery session already set by /auth/confirm-reset, and picks
// a new password.
//
// Server Component. Guards on the recovery session: if there's no signed-
// in user (e.g. someone navigated here directly, or the link expired) we
// send them back to /forgot-password rather than show a form that can't
// work. The set-password form itself is a client component so it can show
// inline validation, but submission goes through the updatePassword
// server action.

import { redirect } from "next/navigation";

import { Heading, Wordmark } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

type SearchParams = Promise<{ error?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No recovery session → the link is missing, expired, or already used.
  if (!user) {
    redirect("/forgot-password?error=expired");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <Heading as="h1" size="page" className="pb-0">
            Choose a new password
          </Heading>
        </div>

        <ResetPasswordForm error={error} />
      </div>
    </main>
  );
}
