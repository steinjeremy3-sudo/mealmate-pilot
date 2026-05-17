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
  // (e.g. trigger hasn't fired) we send them home and let the layouts
  // handle the awkward state.
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const dest = profile ? homeForRole(profile.role) : "/";
  return NextResponse.redirect(new URL(dest, url));
}
