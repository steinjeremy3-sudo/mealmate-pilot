// Merchant-name normalization for Phase 4c matching.
//
// Plaid surfaces three merchant-ish fields on a transaction:
//   - merchant_name: cleaned, when Plaid recognizes the merchant
//   - name: raw POS string ("LUCIA RESTAURANT BISHOP A")
//   - personal_finance_category: their inferred bucket
//
// We can't trust merchant_name for unrecognized merchants and we want
// a single normalized form to compare against `restaurants.name`. This
// module produces that normalized form. Pure functions, fully tested.
//
// Design notes:
// - We DO strip POS prefixes ("TST*", "SQ *", etc.) since they're
//   payment-processor noise unrelated to the merchant identity.
// - We DO strip store numbers and trailing city/state tokens.
// - We do NOT strip restaurant-type words like "restaurant", "cafe",
//   "bar" — token containment in scorer handles those cleanly, and
//   stripping them loses information for names that literally include
//   them (e.g., "Bishop Arts Restaurant").

/**
 * POS-processor and aggregator prefixes that appear before the actual
 * merchant name on bank statements. Order matters within a category
 * only insofar as we want broader patterns (e.g. trailing `*`) to be
 * caught first via the regex. Comparison is case-insensitive.
 */
const POS_PREFIXES = [
  /^TST\*\s*/i,        // Toast
  /^SQ\s*\*\s*/i,      // Square
  /^STRIPE\s*\*\s*/i,  // Stripe
  /^PAYPAL\s*\*\s*/i,  // PayPal
  /^PP\*\s*/i,         // PayPal (older format)
  /^CLOVER\s*\*\s*/i,  // Clover
  /^DOORDASH\s*\*\s*/i,
  /^UBER\s*EATS\s*\*?\s*/i,
  /^GRUBHUB\s*\*?\s*/i,
  /^POSTMATES\s*\*?\s*/i,
  /^OPENTABLE\s*\*?\s*/i,
  /^RESY\s*\*?\s*/i,
];

/** Trailing tokens that look like store numbers / location codes. */
const TRAILING_NOISE = [
  /\s+#\d+\s*$/,                      // " #1234"
  /\s+STORE\s+\d+\s*$/i,              // " STORE 456"
  /\s+\d{3,}\s*$/,                    // trailing pure number runs
  /\s+[A-Z]{2}\s*$/,                  // " TX" (state abbrev)
  /\s+[A-Z][A-Z]\s+\d{5}(-\d{4})?\s*$/,// " TX 75208"
  /\s+\d{5}(-\d{4})?\s*$/,            // " 75208"
];

/** Single token that's clearly a US state abbreviation at end. */
const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
  "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
  "TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

/**
 * Canonical form for similarity comparison. Lowercased, alphanumerics
 * + single spaces, POS prefixes and trailing location noise removed.
 *
 * Examples (raw → normalized):
 *   "TST* Lucia"                        → "lucia"
 *   "SQ *LUCIA"                         → "lucia"
 *   "LUCIA RESTAURANT BISHOP ARTS"      → "lucia restaurant bishop arts"
 *   "LUCIA RESTAURANT BISHOP A"         → "lucia restaurant bishop a"
 *   "LUCIA         DALLAS TX"           → "lucia dallas"
 *   "Bishop Arts #1234"                 → "bishop arts"
 *   "BISHOP ARTS, DALLAS, TX 75208"     → "bishop arts dallas"
 */
export function normalizeMerchantName(raw: string): string {
  if (!raw) return "";
  let s = raw;

  // 1. Strip leading POS prefixes (loop in case nested, e.g. "TST*SQ *X").
  for (let i = 0; i < 3; i++) {
    let stripped = s;
    for (const re of POS_PREFIXES) stripped = stripped.replace(re, "");
    if (stripped === s) break;
    s = stripped;
  }

  // 2. Lowercase + replace any non-alphanumeric with space.
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, " ");

  // 3. Collapse whitespace, trim.
  s = s.replace(/\s+/g, " ").trim();

  // 4. Strip trailing state abbreviation and zip code patterns (those
  //    survived step 2 as bare tokens).
  s = s.replace(/\s+\d{5}(\d{4})?$/, ""); // " 75208" or " 752080000"
  const tokens = s.split(" ");
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (/^\d{3,}$/.test(last)) {
      // trailing pure-number tokens are store numbers
      tokens.pop();
      continue;
    }
    if (last.length === 2 && US_STATES.has(last.toUpperCase())) {
      tokens.pop();
      continue;
    }
    break;
  }
  s = tokens.join(" ");

  // 5. Apply trailing-noise regexes one more time on the cleaned string.
  for (const re of TRAILING_NOISE) s = s.replace(re, "");

  return s.trim();
}
