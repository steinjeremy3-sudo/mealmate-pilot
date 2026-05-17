// Supabase session-refresh middleware.
//
// Every request runs through this so the Supabase auth cookies are kept
// fresh on both the request (for downstream RSCs to read) and the response
// (for the browser to set). Follows the official @supabase/ssr Next.js
// App Router recipe — be careful editing; small reorderings break things.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update the request first so RSCs run with the new cookies...
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // ...then rebuild the response with the same cookies for the browser.
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do not put any code between createServerClient and getUser().
  // getUser() is what actually validates the token and triggers refresh.
  await supabase.auth.getUser();

  return supabaseResponse;
}
