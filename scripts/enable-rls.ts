// Enable Row Level Security on every application table.
//
// Phase 0 only enables RLS — it does NOT add any policies. With RLS on and
// no policies, every authenticated query returns zero rows. That's expected;
// policies arrive in Phase 1 alongside auth (per BRIEF.md "Three things
// likely to bite in Phase 0", item #2).
//
// Idempotent: running `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on a table
// that already has it on is a no-op.
//
// Usage: `npm run db:enable-rls`

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(2);
}

// All 8 application tables from BRIEF.md.
const TABLES = [
  "users",
  "restaurants",
  "offers",
  "claims",
  "cards",
  "payments",
  "audit_log",
  "stripe_events",
];

const sql = postgres(url, { prepare: false });

// Wrapped in main() because tsx compiles to CJS here (no "type":"module"),
// and CJS doesn't support top-level await.
async function main() {
  try {
    for (const table of TABLES) {
      // sql.unsafe is required because table names can't be parameterized.
      // The names are hard-coded above, so there's no injection risk.
      await sql.unsafe(`alter table public."${table}" enable row level security;`);
      console.log(`  RLS enabled on public.${table}`);
    }
    console.log("OK — RLS enabled on all 8 tables.");
    await sql.end();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FAIL — could not enable RLS:");
    console.error(`  ${message}`);
    await sql.end({ timeout: 1 }).catch(() => undefined);
    process.exit(1);
  }
}

void main();
