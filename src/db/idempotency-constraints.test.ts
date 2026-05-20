// A2 — assert the database-level idempotency constraints are actually
// declared in the migration SQL.
//
// The replay tests prove the *handler logic* is idempotent against a
// constraint-enforcing store. This test proves the other half: that
// the constraints the handlers (and the fake) rely on really exist in
// the migrations — so production Postgres enforces them too.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "drizzle");

/** All migration SQL concatenated + lowercased. */
function allMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n")
    .toLowerCase();
}

describe("idempotency constraints are declared in migrations", () => {
  const sql = allMigrationSql();

  // Each entry: a column whose UNIQUE-ness (or PK) is what makes a
  // replayed insert fail instead of duplicating money/state.
  const uniqueColumns: { what: string; pattern: RegExp }[] = [
    {
      what: "matched_transactions.plaid_transaction_id (Plaid ingest dedup)",
      pattern: /"plaid_transaction_id"\s+text\s+not null\s+unique/,
    },
    {
      what: "rebates.matched_transaction_id (one rebate per match)",
      pattern: /"matched_transaction_id"\s+uuid\s+not null\s+unique/,
    },
    {
      what: "rebates.provider_transfer_id (one row per Dwolla transfer)",
      pattern: /"provider_transfer_id"\s+text\s+unique/,
    },
    {
      what: "settlements.stripe_invoice_id (one settlement per invoice)",
      pattern: /"stripe_invoice_id"\s+text\s+unique/,
    },
    {
      what: "plaid_card_accounts.plaid_account_id",
      pattern: /"plaid_account_id"\s+text\s+not null\s+unique/,
    },
    {
      what: "plaid_items.plaid_item_id",
      pattern: /"plaid_item_id"\s+text\s+not null\s+unique/,
    },
    {
      what: "stripe_events.id (webhook event dedup — PK)",
      pattern: /"id"\s+text\s+primary key/,
    },
  ];

  for (const { what, pattern } of uniqueColumns) {
    it(`declares: ${what}`, () => {
      expect(sql).toMatch(pattern);
    });
  }
});
