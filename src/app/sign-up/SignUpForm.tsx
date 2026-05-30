"use client";

// Role-fixed sign-up form. Used by /sign-up/diner and /sign-up/merchant.
// The role is a hidden input — no chooser, no other-role copy. Each caller
// route owns its own header, subhead, and submit-label copy.
//
// Diners can sign up with email OR a US mobile number (`allowPhone`); the
// toggle swaps between the email form (→ signUp) and the phone form (→
// startPhoneAuth, which texts a code and continues at /verify-phone).
// Merchants stay email-only.

import { useState } from "react";

import { Button, Card } from "@/components/brand";
import { signUp, startPhoneAuth } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";

function NameFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">First name</span>
        <input
          type="text"
          name="first_name"
          required
          autoComplete="given-name"
          className={inputClass}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Last name</span>
        <input
          type="text"
          name="last_name"
          required
          autoComplete="family-name"
          className={inputClass}
        />
      </label>
    </div>
  );
}

export function SignUpForm({
  role,
  submitLabel,
  error,
  allowPhone = false,
  initialMethod = "email",
}: {
  role: "diner" | "merchant";
  submitLabel: string;
  error?: string;
  /** Diners may sign up by phone; merchants are email-only. */
  allowPhone?: boolean;
  /** Which tab to open first (phone errors reopen the phone tab). */
  initialMethod?: "email" | "phone";
}) {
  const [method, setMethod] = useState<"email" | "phone">(
    allowPhone ? initialMethod : "email",
  );

  return (
    <Card>
      {allowPhone ? (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-bone-deep p-1">
          {(["email", "phone"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={
                "rounded-md py-1.5 text-sm font-medium capitalize transition-colors " +
                (method === m
                  ? "bg-bone text-ink shadow-sm"
                  : "text-muted-foreground hover:text-ink")
              }
            >
              {m}
            </button>
          ))}
        </div>
      ) : null}

      {method === "email" ? (
        <form action={signUp} className="space-y-4">
          <input type="hidden" name="role" value={role} />
          <NameFields />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              Password{" "}
              <span className="font-normal text-muted-foreground">
                (optional — blank uses magic links)
              </span>
            </span>
            <input
              type="password"
              name="password"
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full">
            {submitLabel}
          </Button>
        </form>
      ) : (
        <form action={startPhoneAuth} className="space-y-4">
          <input type="hidden" name="mode" value="signup" />
          <NameFields />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Mobile number</span>
            <input
              type="tel"
              name="phone"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="(214) 555-1234"
              className={inputClass}
            />
            <span className="text-xs text-muted-foreground">
              US numbers only. We&apos;ll text you a code to confirm.
            </span>
          </label>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full">
            Text me a code
          </Button>
        </form>
      )}
    </Card>
  );
}
