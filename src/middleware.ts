// Next.js middleware. Runs on every request that matches the `matcher`
// config below, refreshing the Supabase session before any RSC sees it.

import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except Next's static assets and image optimization.
  // Auth-gated pages still check session in their own layouts; middleware
  // just keeps the cookie fresh so those checks have current data.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
