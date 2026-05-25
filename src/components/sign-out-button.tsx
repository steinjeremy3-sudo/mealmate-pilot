// Shared sign-out button. Server Component — the form posts directly to
// the signOut server action and the action handles the redirect.

import { signOut } from "@/app/auth/actions";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={
          "cursor-pointer rounded-full border border-border bg-transparent px-3.5 py-1.5 " +
          "text-xs font-medium text-muted-foreground transition-colors " +
          "hover:bg-bone-deep hover:text-foreground " +
          className
        }
      >
        Sign out
      </button>
    </form>
  );
}
