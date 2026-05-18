// Drizzle migrate runner. Applies every unapplied migration in
// drizzle/ in order, tracked via drizzle.__drizzle_migrations.
//
// Usage: `npm run db:migrate`
//
// The first time this runs against an existing DB (already at the
// baseline schema), you must FIRST run `npm run db:bootstrap-migrations`
// to mark the baseline as already-applied. Otherwise migrate will
// try to CREATE tables that already exist and fail.

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(2);
}

async function main() {
  // postgres-js with max:1 — migrator wants a serial connection.
  const sql = postgres(url!, { max: 1, prepare: false });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("OK — migrations up to date.");
    await sql.end();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FAIL — migrate:");
    console.error(`  ${message}`);
    await sql.end({ timeout: 1 }).catch(() => undefined);
    process.exit(1);
  }
}

void main();
