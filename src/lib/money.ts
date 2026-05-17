// Money helpers. All money inside the system is stored as INTEGER cents
// (never floats) — see the `*_cents` columns in src/db/schema.ts. These
// helpers convert to/from user-facing dollars.
//
// Kept tiny on purpose; expand only when we need new shapes.

/** Format an integer-cents amount as a user-facing dollar string ("$12.34"). */
export function centsToUsd(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
}

/** Convert a dollar amount to integer cents, rounding to the nearest cent. */
export function usdToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
