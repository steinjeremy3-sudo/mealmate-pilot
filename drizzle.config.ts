// Drizzle Kit config. Used by `drizzle-kit push` (Phase 0) and later by
// `generate` + `migrate` once we have real data and need file-based migrations.
//
// PHASE 0 NOTE: per BRIEF.md, `push` is fine while we have no production data.
// Switch to `generate` + `migrate` BEFORE Phase 2.

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
  out: "./drizzle",                  // future migration files land here
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // strict: true would prompt on every push (requires a TTY). Off during
  // Phase 0 so `npm run db:push` is non-interactive. Drizzle still asks
  // before destructive changes (DROP, etc.) — turn this back on once we
  // switch to `generate` + `migrate` before Phase 2.
  verbose: true,
});
