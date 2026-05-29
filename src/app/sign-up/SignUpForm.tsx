// Role-fixed sign-up form. Used by /sign-up/diner and /sign-up/merchant.
// The role is a hidden input — no chooser, no other-role copy. Each
// caller route owns its own header, subhead, and submit-label copy.

import { Button, Card } from "@/components/brand";
import { signUp } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";

export function SignUpForm({
  role,
  submitLabel,
  nameLabel,
  error,
}: {
  role: "diner" | "merchant";
  submitLabel: string;
  /** What to call the name field — "Your name" / "Owner name" / etc. */
  nameLabel: string;
  error?: string;
}) {
  return (
    <Card>
      <form action={signUp} className="space-y-4">
        <input type="hidden" name="role" value={role} />

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{nameLabel}</span>
          <input
            type="text"
            name="display_name"
            required
            autoComplete="name"
            className={inputClass}
          />
        </label>

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
    </Card>
  );
}
