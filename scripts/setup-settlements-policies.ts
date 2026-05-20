// Apply scripts/settlements-policies.sql. Idempotent.
//
// Usage: `npm run setup:settlements-policies`

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

const sqlPath = resolve(process.cwd(), "scripts/settlements-policies.sql");
const sqlText = readFileSync(sqlPath, "utf8");

const sql = postgres(url, { prepare: false });

async function main() {
  try {
    await sql.unsafe(sqlText);
    console.log("OK — settlements-policies.sql applied.");
    await sql.end();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FAIL — could not apply settlements-policies.sql:");
    console.error(`  ${message}`);
    await sql.end({ timeout: 1 }).catch(() => undefined);
    process.exit(1);
  }
}

void main();
