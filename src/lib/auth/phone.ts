// US phone-number normalization for SMS sign-in.
//
// The Dallas pilot is US-only, so we accept a 10-digit US number (with or
// without the +1 country code and any human formatting — spaces, dashes,
// parens, dots) and return it in the E.164 form Supabase/Twilio expect:
// "+1XXXXXXXXXX". Anything that isn't a valid US number returns null so
// the caller can show a friendly error instead of paying for an SMS that
// can't deliver.

/** A US number in E.164 form, e.g. "+12145551234", or null if invalid. */
export function normalizeUsPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  // 11 digits with a leading country code of 1 → drop the 1.
  const local =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits;

  if (local.length !== 10) return null;
  // US area codes and exchange codes never start with 0 or 1.
  if (local[0] === "0" || local[0] === "1") return null;

  return `+1${local}`;
}

/** Format an E.164 US number for display, e.g. "+1 (214) 555-1234". */
export function formatUsPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+1 (${m[1]}) ${m[2]}-${m[3]}`;
}
