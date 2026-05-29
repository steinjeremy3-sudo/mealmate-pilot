"use client";

// Launch-updates signup at the footer. Same useActionState pattern as
// the contact form.

import { useActionState } from "react";

import { joinLaunchList, type FormState } from "@/app/(public)/actions";

export function LaunchSignup() {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    joinLaunchList,
    null,
  );

  if (state?.ok) {
    return (
      <p className="rounded-lg border border-paprika/30 bg-paprika-tint px-4 py-3 text-sm font-medium text-ink">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="email"
        type="email"
        required
        placeholder="you@email.com"
        autoComplete="email"
        className="flex-1 rounded-lg border border-border bg-bone px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Sending…" : "Subscribe"}
      </button>
      {state && !state.ok ? (
        <p className="text-xs text-destructive sm:absolute sm:translate-y-12" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
