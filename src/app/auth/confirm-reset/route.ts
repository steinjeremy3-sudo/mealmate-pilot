// Password-recovery callback. The "reset your password" email links here
// with a `code`. We exchange it for a (recovery) session — which must
// happen in a route handler so the session cookie actually persists —
// then forward to /reset-password where the user picks a new password.
//
// Mirrors /auth/callback, but the destination is the set-password form
// rather than the role home (the user isn't "done" until they save a
// new password).

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    // Stale/!malformed link, or Supabase redirect URL not allow-listed.
    return NextResponse.redirect(
      new URL("/forgot-password?error=missing-code", url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/forgot-password?error=${encodeURIComponent(error.message)}`, url),
    );
  }

  return NextResponse.redirect(new URL("/reset-password", url));
}
