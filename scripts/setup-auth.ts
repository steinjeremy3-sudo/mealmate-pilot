// Apply scripts/auth-setup.sql to the Supabase database.
//
// Idempotent — the SQL file is written with DROP IF EXISTS before every
// CREATE, so re-running this script will just no-op refresh the trigger,
// helper function, and RLS policies.
//
// Usage: `npm run setup:auth`

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(2);
}

const sqlPath = resolve(process.cwd(), "scripts/auth-setup.sql");
const sqlText = readFileSync(sqlPath, "utf8");

const sql = postgres(url, { prepare: false });

async function main() {
  try {
    // Run the whole file as one transaction.
    await sql.unsafe(sqlText);
    console.log("OK — auth-setup.sql applied (trigger + helpers + RLS policies).");
    await sql.end();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FAIL — could not apply auth-setup.sql:");
    console.error(`  ${message}`);
    await sql.end({ timeout: 1 }).catch(() => undefined);
    process.exit(1);
  }
}

void main();
