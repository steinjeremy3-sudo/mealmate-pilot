"use client";

// Set-new-password form. Two fields (new password + confirm) submitted to
// the updatePassword server action, which validates server-side and
// redirects to the user's role home on success. We also do a light
// client-side check so the user gets instant feedback before a round-trip.

import { useState } from "react";

import { Button, Card } from "@/components/brand";
import { updatePassword } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";

export function ResetPasswordForm({ error }: { error?: string }) {
  const [clientError, setClientError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement)
      .value;
    if (password.length < 8) {
      e.preventDefault();
      setClientError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      e.preventDefault();
      setClientError("Passwords don't match.");
      return;
    }
    setClientError(null);
  }

  // Server-reported error wins on first render; client error takes over
  // once the user starts interacting.
  const shownError = clientError ?? error;

  return (
    <Card>
      <form action={updatePassword} onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">New password</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
          <span className="text-xs text-muted-foreground">
            At least 8 characters.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Confirm new password</span>
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>

        {shownError ? (
          <p className="text-sm text-destructive" role="alert">
            {shownError}
          </p>
        ) : null}

        <Button type="submit" className="w-full">
          Save new password
        </Button>
      </form>
    </Card>
  );
}
