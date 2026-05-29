// Magic-link callback. Supabase Auth sends users here after they click
// the link in the email. We exchange the `code` for a session, then send
// them to their role's home.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/post-signin";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    // Likely a stale link or a misconfigured Supabase redirect URL.
    return NextResponse.redirect(new URL("/sign-in?error=missing-code", url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, url),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in?error=no-session", url));
  }

  // Look up role to pick the destination. If the row isn't there yet
  // (e.g. handle_new_user trigger hasn't fired) we surface a visible
  // signal at /sign-in rather than dropping the user on the marketing
  // page with no explanation.
  const { data: profile, error: profileErr } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    console.error(
      `[auth/callback] no public.users row for ${user.email} (${user.id}):`,
      profileErr?.message ?? "(empty result)",
    );
    return NextResponse.redirect(
      new URL("/sign-in?error=no-profile", url),
    );
  }

  return NextResponse.redirect(new URL(homeForRole(profile.role), url));
}
