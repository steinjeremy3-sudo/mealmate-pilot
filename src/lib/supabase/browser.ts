// Browser-side Supabase client.
//
// Safe to use in Client Components. Reads the publishable / anon key from
// NEXT_PUBLIC_SUPABASE_ANON_KEY — never the service role key.

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
