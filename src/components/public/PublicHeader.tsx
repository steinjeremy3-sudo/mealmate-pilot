// Header for the public surface — marketing pages + anon-browseable
// offers + restaurants. Auth-aware: shows Sign in / Sign up when no
// session; switches to "→ App" / "→ Dashboard" / "→ Ops" once signed in.
//
// Server component so the auth lookup happens during render — no
// hydration flash.

import Link from "next/link";

import { Wordmark } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/post-signin";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/browse", label: "Browse offers" },
  { href: "/for-restaurants", label: "For restaurants" },
];

async function getCurrentRole(): Promise<"diner" | "merchant" | "admin" | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return (data?.role as "diner" | "merchant" | "admin" | undefined) ?? null;
}

export async function PublicHeader({
  className,
}: {
  className?: string;
}) {
  const role = await getCurrentRole();
  // Diner + merchant see a one-tap entry to their app surface. Admin
  // deliberately does NOT — the ops console is a privately-known
  // direct URL (/admin) so anyone glancing at a signed-in admin's
  // browser doesn't learn it exists.
  const appHref =
    role === "diner" || role === "merchant" ? homeForRole(role) : null;
  const appLabel = role === "merchant" ? "Dashboard" : "App";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-bone/90 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        <nav className="hidden gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink/75 transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {appHref ? (
            <Link
              href={appHref}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
            >
              {appLabel} →
            </Link>
          ) : role === "admin" ? (
            // Admin: render no auth-specific button. Ops console is a
            // privately-known URL — don't surface it in chrome.
            null
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-ink/75 transition-colors hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up?as=diner"
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
