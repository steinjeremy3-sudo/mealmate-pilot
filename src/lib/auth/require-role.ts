// Server-side auth gate for role-specific layouts.
//
// Pattern: in a layout file, call `requireRole("merchant")` at the top.
// If the user isn't signed in → redirect to /sign-in.
// If they're signed in but the wrong role → redirect to their own home.
// Otherwise return their profile.

import { cache } from "react";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/post-signin";

export type UserRole = "diner" | "merchant" | "admin";

export type SignedInProfile = {
  id: string;
  email: string | null;
  role: UserRole;
  displayName: string;
};

// React.cache dedupes requireRole calls within a single request — so a
// layout and its children pages can each call this without triggering
// extra Supabase / DB roundtrips.
export const requireRole = cache(async function _requireRole(
  role: UserRole,
): Promise<SignedInProfile> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, email, role, display_name")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // Unknown profile state — bounce them to sign-in and let them retry.
    redirect("/sign-in?error=no-profile");
  }

  if (profile.role !== role) {
    // Wrong role — send them to their own home rather than 403'ing.
    redirect(homeForRole(profile.role));
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    displayName: profile.display_name,
  };
});
