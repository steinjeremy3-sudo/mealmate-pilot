// One-time bootstrap: tell drizzle's migration tracker that every
// existing migration in drizzle/ has already been applied to this DB.
//
// Why: we're switching from `drizzle-kit push` (which mutated the DB
// directly during Phases 0–2e) to `generate + migrate`. The current DB
// is already at the baseline schema state. If we ran `migrate` cold,
// it would try to CREATE all 8 tables and fail because they exist.
//
// What this script does: for every entry in drizzle/meta/_journal.json,
// compute the same SHA-256 hash the drizzle migrator computes from the
// SQL file content, and INSERT it into drizzle.__drizzle_migrations
// with the journal's `when` timestamp as created_at. Idempotent — uses
// ON CONFLICT (hash) DO NOTHING.
//
// Run once (safe to re-run). After this, use `npm run db:migrate` for
// every future schema change.
//
// Usage: `npm run db:bootstrap-migrations`

import crypto from "node:crypto";
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

type JournalEntry = { idx: number; when: number; tag: string };

async function main() {
  const journalPath = resolve(process.cwd(), "drizzle/meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: JournalEntry[];
  };

  if (journal.entries.length === 0) {
    console.log("No migrations in journal — nothing to bootstrap.");
    process.exit(0);
  }

  const sql = postgres(url!, { max: 1, prepare: false });

  try {
    // Create the drizzle schema + migration tracking table if not present.
    // Same DDL the migrator would run on first call.
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
    // Need uniqueness on hash for ON CONFLICT to work — guard with index.
    await sql.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS __drizzle_migrations_hash_idx
        ON drizzle.__drizzle_migrations (hash)
    `);

    for (const entry of journal.entries) {
      const sqlPath = resolve(process.cwd(), `drizzle/${entry.tag}.sql`);
      const sqlText = readFileSync(sqlPath, "utf8");
      // Matches drizzle/migrator.js: sha256 of the full file content.
      const hash = crypto.createHash("sha256").update(sqlText).digest("hex");

      const result = await sql`
        insert into drizzle.__drizzle_migrations ("hash", "created_at")
        values (${hash}, ${entry.when})
        on conflict (hash) do nothing
        returning id
      `;

      if (result.length > 0) {
        console.log(`  marked ${entry.tag} as applied (created_at=${entry.when})`);
      } else {
        console.log(`  ${entry.tag} already marked applied — skipped`);
      }
    }

    console.log("OK — drizzle.__drizzle_migrations reflects current state.");
    await sql.end();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FAIL — bootstrap-migrations:");
    console.error(`  ${message}`);
    await sql.end({ timeout: 1 }).catch(() => undefined);
    process.exit(1);
  }
}

void main();
