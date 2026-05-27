// Enable Row Level Security on every application table.
//
// With RLS on and no matching policy, an authenticated query returns
// zero rows — that's the goal, defense-in-depth against missing
// policies. Per-feature setup scripts (`setup:offer-policies`,
// `setup:claim-policies`, etc.) layer SELECT/INSERT/UPDATE policies
// on top.
//
// Idempotent: running `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on
// a table that already has it on is a no-op.
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

// Every application table in the current schema. Keep this in sync
// with src/db/schema.ts — `cards` and `payments` were retired in the
// rebate-model refactor (migration 0002) and are gone from here.
const TABLES = [
  "users",
  "restaurants",
  "restaurant_stripe_accounts",
  "offers",
  "claims",
  "plaid_items",
  "plaid_card_accounts",
  "diner_dwolla_accounts",
  "diner_astra_accounts",
  "menu_items",
  "matched_transactions",
  "rebates",
  "settlements",
  "restaurant_billing_customers",
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
    console.log(`OK — RLS enabled on all ${TABLES.length} tables.`);
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
