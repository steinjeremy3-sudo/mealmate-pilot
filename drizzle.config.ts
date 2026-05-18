// Drizzle Kit config. Used by `npm run db:generate` (creates a new
// migration file in drizzle/ from schema diffs) and `npm run db:migrate`
// (applies pending migrations, tracked in drizzle.__drizzle_migrations).
//
// Legacy `drizzle-kit push` was used during Phases 0–2e while the DB
// schema was still fluid; we've switched to file-based migrations now
// that data lives in the DB.

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not auto-load `.env.local` (it only auto-loads `.env`).
// Load it explicitly so npm scripts don't need a custom runner.
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",                  // generated migrations + journal land here
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // strict: true asks before applying destructive changes. We're past the
  // push-prompt era now — schema changes go through `generate` + `migrate`,
  // not interactive `push`. See `npm run db:generate` / `db:migrate`.
  strict: true,
  verbose: true,
});
