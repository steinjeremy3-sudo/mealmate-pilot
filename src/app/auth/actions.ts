"use server";

// Server actions for sign-in / sign-up / sign-out.
//
// All paths end in `redirect()` — never `return` — so the calling forms
// can stay Server Components (no useActionState plumbing). Errors are
// surfaced via `?error=...` on the source page.
//
// Magic link is the default. If the user filled in a password we use
// password auth instead. Sign-up writes role + display_name into the
// auth.users metadata bag so the public.handle_new_user trigger picks
// them up when the row is created (see scripts/auth-setup.sql).

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirectToRoleHome } from "@/lib/auth/post-signin";

/** Best-effort origin for building magic-link redirect URLs. */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function errParam(path: string, message: string): string {
  return `${path}?error=${encodeURIComponent(message)}`;
}

// ----------------------------------------------------------------
// Sign in (magic link OR password)
// ----------------------------------------------------------------
export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email) {
    redirect(errParam("/sign-in", "Email is required."));
  }

  const supabase = await createSupabaseServerClient();

  if (password.length > 0) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      redirect(errParam("/sign-in", error.message));
    }
    await redirectToRoleHome();
  }

  // No password → magic link.
  const origin = await getOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    redirect(errParam("/sign-in", error.message));
  }
  redirect(`/sign-in?sent=1&email=${encodeURIComponent(email)}`);
}

// ----------------------------------------------------------------
// Sign up (web → merchant only)
// ----------------------------------------------------------------
export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) redirect(errParam("/sign-up", "Email is required."));
  if (!displayName) redirect(errParam("/sign-up", "Name is required."));

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  // role + display_name go into auth.users.raw_user_meta_data and are
  // read out by the handle_new_user trigger to populate public.users.
  // Web sign-up is merchant-only; admins are created by hand.
  const metadata = { role: "merchant", display_name: displayName };

  if (password.length > 0) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback`, data: metadata },
    });
    if (error) redirect(errParam("/sign-up", error.message));
    redirect(`/sign-up?sent=1&email=${encodeURIComponent(email)}`);
  }

  // No password → passwordless signup via magic link.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: metadata,
      shouldCreateUser: true,
    },
  });
  if (error) redirect(errParam("/sign-up", error.message));
  redirect(`/sign-up?sent=1&email=${encodeURIComponent(email)}`);
}

// ----------------------------------------------------------------
// Sign out
// ----------------------------------------------------------------
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
