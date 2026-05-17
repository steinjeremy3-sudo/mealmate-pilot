// Server-side Supabase client (SSR-aware).
//
// Use this in Server Components, server actions, and route handlers when you
// need the *user's* session (RLS will scope queries to whoever is signed in).
//
// For admin / RLS-bypass operations (webhooks, cron, etc.) use
// `createSupabaseAdminClient` from ./admin instead.

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  // In Next 15+, `cookies()` returns a Promise.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // setAll throws if called from a Server Component (cookies are
          // read-only there). Swallow — the middleware will refresh the
          // session on the next request.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // intentional no-op (read-only cookie context)
          }
        },
      },
    },
  );
}
