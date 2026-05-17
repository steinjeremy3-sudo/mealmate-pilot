// Shared sign-out button. Server Component — the form posts directly to
// the signOut server action and the action handles the redirect.

import { signOut } from "@/app/auth/actions";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={
          "rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary " +
          className
        }
      >
        Sign out
      </button>
    </form>
  );
}
