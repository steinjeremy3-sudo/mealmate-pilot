// Role-based post-signin destination.
//
// Used by /auth/callback (after magic link) and the password sign-in flow
// to send a user to the right section based on their `users.role`.

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Path a user with the given role should land on after signing in.
 */
export function homeForRole(role: "diner" | "merchant" | "admin"): string {
  switch (role) {
    case "diner":
      return "/app";
    case "merchant":
      return "/dashboard";
    case "admin":
      return "/admin";
  }
}

/**
 * Server-side helper: read the signed-in user's role from public.users and
 * redirect to their home. Use in Server Components or server actions.
 * Throws via Next's redirect() — never returns on success.
 */
export async function redirectToRoleHome(): Promise<never> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // No profile means the handle_new_user trigger didn't fire (or RLS
  // hid it). Either way the safest fallback is to bounce them out and
  // let them retry.
  if (error || !profile) {
    redirect("/sign-in?error=no-profile");
  }

  redirect(homeForRole(profile.role));
}
