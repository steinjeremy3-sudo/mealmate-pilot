// Connectivity test script (Phase 0 acceptance criterion #6).
//
// Runs `select count(*) from users` against DATABASE_URL and prints the count.
// Exits 0 on success, non-zero on any failure.
//
// Usage: `npm run db:ping`

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(2);
}

const sql = postgres(url, { prepare: false });

try {
  const rows = await sql<{ count: string }[]>`select count(*)::text as count from users`;
  console.log(`OK — users table is reachable. count(*) = ${rows[0].count}`);
  await sql.end();
  process.exit(0);
} catch (err) {
  // Don't leak the connection string in error output.
  const message = err instanceof Error ? err.message : String(err);
  console.error("FAIL — could not query users:");
  console.error(`  ${message}`);
  await sql.end({ timeout: 1 }).catch(() => undefined);
  process.exit(1);
}
