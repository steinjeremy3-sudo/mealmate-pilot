// Auto-approval rubric — BRIEF.md "The auto-approval rubric (core ops concept)".
//
// Six checks every payment runs through. All pass → auto-approve. Any fail
// → flag for human review in the admin portal. Target auto-approval rate
// is 94% (the marketplace scale story).
//
// This module is pure logic — call it from payClaim AFTER the charge
// succeeds, then set auto_approval_status + flagged_reasons accordingly.

export type RubricCheck =
  | "timing"
  | "day"
  | "min_spend"
  | "mcc"
  | "max_per_diner"
  | "card_match";

export type RubricInput = {
  /** When the diner claimed the offer (DB timestamp; UTC). */
  claimedAt: Date;

  // Offer windows (Dallas-local time-of-day strings, "HH:MM" or "HH:MM:SS").
  offerValidStartTime: string;
  offerValidEndTime: string;
  /** Allowed days, lowercase 3-letter codes: "mon","tue",... */
  offerValidDays: string[];

  offerMinSpendCents: number;
  offerMaxClaimsPerDiner: number;

  /** Subtotal entered by the diner at pay time. */
  subtotalCents: number;

  /** restaurants.mcc. Pilot only supports 5812 (sit-down restaurants). */
  restaurantMcc: string;

  /**
   * Number of times THIS diner has claimed THIS offer (including the
   * current claim about to be paid). Compared against
   * offerMaxClaimsPerDiner.
   */
  totalDinerClaimsOnOffer: number;

  /**
   * Did the card used at payment belong to the diner who made the claim?
   * In v1 this is implicit (we always charge the diner's saved card) but
   * we still surface it as a defensive check.
   */
  cardBelongsToDiner: boolean;
};

export type RubricResult = {
  passed: boolean;
  failedChecks: RubricCheck[];
};

export function evaluateRubric(input: RubricInput): RubricResult {
  const failed: RubricCheck[] = [];

  if (!claimedAtInValidWindow(input.claimedAt, input.offerValidStartTime, input.offerValidEndTime)) {
    failed.push("timing");
  }

  if (!input.offerValidDays.includes(chicagoDayCode(input.claimedAt))) {
    failed.push("day");
  }

  if (input.subtotalCents < input.offerMinSpendCents) {
    failed.push("min_spend");
  }

  // Pilot scope: only sit-down restaurants are eligible. Future:
  // per-offer MCC field with a list of allowed codes.
  if (input.restaurantMcc !== "5812") {
    failed.push("mcc");
  }

  if (input.totalDinerClaimsOnOffer > input.offerMaxClaimsPerDiner) {
    failed.push("max_per_diner");
  }

  if (!input.cardBelongsToDiner) {
    failed.push("card_match");
  }

  return { passed: failed.length === 0, failedChecks: failed };
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const CHICAGO = "America/Chicago";

/** lowercase 3-letter day code for a UTC date projected to Dallas time. */
export function chicagoDayCode(d: Date): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO,
    weekday: "short",
  }).format(d);
  return weekday.toLowerCase();
}

/** Hours + minutes of a UTC date projected to Dallas time. */
export function chicagoTimeOfDay(d: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  // Intl quirk: returns 24 for midnight in some Node versions; normalize.
  return { hour: hour === 24 ? 0 : hour, minute };
}

function parseHHMM(t: string): { hour: number; minute: number } {
  const [h = "0", m = "0"] = t.split(":");
  return { hour: parseInt(h, 10), minute: parseInt(m, 10) };
}

function toMinutes(t: { hour: number; minute: number }): number {
  return t.hour * 60 + t.minute;
}

/**
 * Is the claim time within the offer's daily window?
 * Handles both same-day windows ("17:00"–"22:00") and overnight windows
 * ("22:00"–"02:00") just in case we ever have a late-night offer.
 */
export function claimedAtInValidWindow(
  claimedAt: Date,
  validStart: string,
  validEnd: string,
): boolean {
  const claim = toMinutes(chicagoTimeOfDay(claimedAt));
  const start = toMinutes(parseHHMM(validStart));
  const end = toMinutes(parseHHMM(validEnd));

  if (start <= end) {
    return claim >= start && claim < end;
  }
  // Overnight wrap: e.g. start=22:00, end=02:00.
  return claim >= start || claim < end;
}
