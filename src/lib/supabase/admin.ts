// Server-only Supabase admin client. Uses the service role key and BYPASSES
// row-level security. Only use this for legitimate admin operations:
//   - webhook handlers (no user session)
//   - cron jobs
//   - one-off seed/repair scripts
//
// IMPORTANT: NEVER import this file from a client component. Doing so would
// ship the service role key to the browser and constitute a full database
// breach (see CLAUDE.md → "What never goes in this repo").

import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Add it to .env.local (and Vercel project env) — see .env.example.",
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
