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
import { homeForRole, redirectToRoleHome } from "@/lib/auth/post-signin";
import { normalizeUsPhone } from "@/lib/auth/phone";

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

/**
 * True when a sign-in error is specifically "the account exists and the
 * password is right, but the email hasn't been confirmed yet." Supabase
 * exposes this as an `email_not_confirmed` error code (older versions only
 * set the message), so we check both.
 */
function isEmailNotConfirmed(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "email_not_confirmed" ||
    /email not confirmed/i.test(error.message ?? "")
  );
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
      // Special-case the most confusing failure: the password is correct
      // but the account's email was never confirmed. Supabase's raw
      // message ("Email not confirmed") reads like a wrong password to a
      // normal person. Route to a dedicated state that explains it and
      // offers a resend, carrying the email so the resend works.
      if (isEmailNotConfirmed(error)) {
        redirect(
          `/sign-in?needsConfirm=1&email=${encodeURIComponent(email)}`,
        );
      }
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
// Sign up (web → diner or merchant; admin is manual)
// ----------------------------------------------------------------
export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Collected as two fields and combined into the single display_name the
  // handle_new_user trigger reads. Keeping display_name = "First Last"
  // means every downstream screen + the Dwolla payout name-split keep
  // working unchanged.
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  const password = String(formData.get("password") ?? "");
  // Role from the form's radio toggle. Only `diner` and `merchant` are
  // valid via the web — admin is created by hand in Supabase. Anything
  // else gets normalized to `diner` as the safer default.
  const rawRole = String(formData.get("role") ?? "diner");
  const role: "diner" | "merchant" = rawRole === "merchant" ? "merchant" : "diner";

  if (!email) redirect(errParam("/sign-up", "Email is required."));
  if (!firstName) redirect(errParam("/sign-up", "First name is required."));
  if (!lastName) redirect(errParam("/sign-up", "Last name is required."));
  // A blank password is allowed (→ magic link). But if one IS given it
  // must meet the same length floor the reset form enforces — the browser
  // checks minLength={8}, this is the server-side backstop.
  if (password.length > 0 && password.length < 8) {
    redirect(errParam("/sign-up", "Password must be at least 8 characters."));
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  // role + display_name go into auth.users.raw_user_meta_data and are
  // read out by the handle_new_user trigger to populate public.users.
  const metadata = { role, display_name: displayName };

  if (password.length > 0) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback`, data: metadata },
    });
    if (error) redirect(errParam("/sign-up", error.message));
    // When email confirmation is disabled in Supabase, signUp returns a
    // live session right away — send them straight to their home instead
    // of the "check your email" interstitial. If confirmation is required,
    // there's no session yet, so fall through to the interstitial.
    if (data.session) {
      redirect(homeForRole(role));
    }
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
// Phone sign-in / sign-up (SMS OTP) — diners only
// ----------------------------------------------------------------
// Two steps, unlike the email magic-link flow (which bounces through
// /auth/callback). Step 1 (startPhoneAuth) texts a 6-digit code; step 2
// (verifyPhoneOtp, from /verify-phone) verifies it inline and creates the
// session. Requires an SMS provider configured in Supabase Auth → Phone.

export async function startPhoneAuth(formData: FormData): Promise<void> {
  const mode = formData.get("mode") === "signup" ? "signup" : "signin";
  // Phone auth is diner-only; the form never offers it to merchants.
  const backPath = mode === "signup" ? "/sign-up/diner" : "/sign-in";
  // Bounce errors back with method=phone so the form reopens the phone tab.
  const phoneErr = (msg: string) =>
    `${backPath}?error=${encodeURIComponent(msg)}&method=phone`;

  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  if (!phone) {
    redirect(phoneErr("Enter a valid US mobile number."));
  }

  // Signup also carries the name so the handle_new_user trigger can
  // populate the profile when the user is created on verify.
  let data: Record<string, string> | undefined;
  if (mode === "signup") {
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    if (!firstName) redirect(phoneErr("First name is required."));
    if (!lastName) redirect(phoneErr("Last name is required."));
    data = { role: "diner", display_name: `${firstName} ${lastName}` };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      channel: "sms",
      // Signup creates the user; signin must NOT (so a typo'd number on
      // sign-in doesn't silently create a new account).
      shouldCreateUser: mode === "signup",
      ...(data ? { data } : {}),
    },
  });
  if (error) redirect(phoneErr(error.message));

  // Carry the phone (and mode, for back-link copy) to the code-entry page.
  redirect(
    `/verify-phone?phone=${encodeURIComponent(phone)}&mode=${mode}`,
  );
}

export async function verifyPhoneOtp(formData: FormData): Promise<void> {
  const phone = String(formData.get("phone") ?? "").trim();
  const mode = formData.get("mode") === "signup" ? "signup" : "signin";
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");

  const back = (msg: string) =>
    `/verify-phone?phone=${encodeURIComponent(phone)}&mode=${mode}&error=${encodeURIComponent(msg)}`;

  if (!phone) redirect(errParam("/sign-in", "Something went wrong — start again."));
  if (token.length !== 6) redirect(back("Enter the 6-digit code."));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  if (error) redirect(back(error.message));

  // Session is set; the trigger has created the profile (signup) or it
  // already existed (signin). Send them to their role's home.
  await redirectToRoleHome();
}

// ----------------------------------------------------------------
// Resend the signup confirmation email
// ----------------------------------------------------------------
// Used when a password sign-in is blocked because the account's email was
// never confirmed (see isEmailNotConfirmed above). Re-sends the original
// confirmation link.

export async function resendConfirmation(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect(errParam("/sign-in", "Email is required."));
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  // Log but don't leak account existence — always report "sent".
  if (error) {
    console.error(`[auth] resendConfirmation(${email}):`, error.message);
  }
  redirect(`/sign-in?sent=1&email=${encodeURIComponent(email)}`);
}

// ----------------------------------------------------------------
// Password reset (forgot password)
// ----------------------------------------------------------------
// Two steps. Step 1 (requestPasswordReset) emails a recovery link that
// lands on /auth/confirm-reset, which exchanges the code for a session
// and forwards to /reset-password. Step 2 (updatePassword) sets the new
// password on that recovery session. Only email accounts have passwords;
// phone-only diners never reach this (no email to send to).

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect(errParam("/forgot-password", "Email is required."));
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm-reset`,
  });
  // Don't leak whether an address is registered — on error we log but
  // still report "sent" so the page can't be used to probe for accounts.
  if (error) {
    console.error(`[auth] resetPasswordForEmail(${email}):`, error.message);
  }
  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}

export async function updatePassword(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    redirect(errParam("/reset-password", "Password must be at least 8 characters."));
  }
  if (password !== confirm) {
    redirect(errParam("/reset-password", "Passwords don't match."));
  }

  const supabase = await createSupabaseServerClient();
  // Requires the recovery session set by /auth/confirm-reset. Without it
  // updateUser returns an auth error, which we bounce back to the form.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(errParam("/reset-password", error.message));
  }

  // Password changed; the recovery session is now a full session. Send
  // them to their role's home.
  await redirectToRoleHome();
}

// ----------------------------------------------------------------
// Sign out
// ----------------------------------------------------------------
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
