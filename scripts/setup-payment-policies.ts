// Apply scripts/payment-policies.sql to the Supabase database. Idempotent.
//
// Usage: `npm run setup:payment-policies`

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

const sqlPath = resolve(process.cwd(), "scripts/payment-policies.sql");
const sqlText = readFileSync(sqlPath, "utf8");

const sql = postgres(url, { prepare: false });

async function main() {
  try {
    await sql.unsafe(sqlText);
    console.log("OK — payment-policies.sql applied.");
    await sql.end();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FAIL — could not apply payment-policies.sql:");
    console.error(`  ${message}`);
    await sql.end({ timeout: 1 }).catch(() => undefined);
    process.exit(1);
  }
}

void main();
