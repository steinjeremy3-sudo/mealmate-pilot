"use client";

// Sign-in form with an Email | Phone toggle. Email uses a password (if
// filled) or a magic link; phone texts a 6-digit code (→ /verify-phone).
// Only phone-registered users (diners who signed up by phone) can complete
// the phone path — for everyone else it's a no-op, so it's safe to show
// the toggle here even though /sign-in is shared across roles.

import { useState } from "react";

import { Button, Card } from "@/components/brand";
import { signIn, startPhoneAuth } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";

export function SignInForm({
  error,
  initialMethod = "email",
}: {
  error?: string;
  initialMethod?: "email" | "phone";
}) {
  const [method, setMethod] = useState<"email" | "phone">(initialMethod);

  return (
    <Card>
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

      {method === "email" ? (
        <form action={signIn} className="space-y-4">
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
                (optional — blank sends a magic link)
              </span>
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className={inputClass}
            />
          </label>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      ) : (
        <form action={startPhoneAuth} className="space-y-4">
          <input type="hidden" name="mode" value="signin" />
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
              The US mobile number you signed up with.
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
