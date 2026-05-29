// Is an offer claimable *right now*?
//
// `status = 'live'` only says the offer is published — it doesn't say
// the offer's daily window is currently open. An offer that runs
// 5:00 PM–11:00 PM is still `live` at 11:30 PM, but a diner can't
// redeem it: a visit now falls outside the window and the matcher
// would reject it (see `claimedAtInValidWindow` in src/lib/rubric.ts).
// So showing it on the browse surfaces as "available" is misleading.
//
// This helper answers "can a diner act on this offer at this instant?"
// using the SAME Dallas-time window logic the matcher uses, so the
// listings and the matcher never disagree about what's in-window.

import { chicagoDayCode, claimedAtInValidWindow } from "@/lib/rubric";

export type OfferAvailabilityInput = {
  valid_days: string[];
  valid_start_time: string; // "HH:MM[:SS]"
  valid_end_time: string;
  /** Overall run window. Recurring-weekly offers leave ends_at null. */
  starts_at?: string | null;
  ends_at?: string | null;
};

/**
 * True if `now` (defaults to the current instant) falls inside the
 * offer's run window, on one of its valid days, within its daily
 * time window — all evaluated in Dallas (America/Chicago) time.
 */
export function isOfferAvailableNow(
  offer: OfferAvailabilityInput,
  now: Date = new Date(),
): boolean {
  // Overall run window: not yet started, or already ended for good.
  if (offer.starts_at && new Date(offer.starts_at) > now) return false;
  if (offer.ends_at && new Date(offer.ends_at) <= now) return false;

  // Today must be one of the offer's valid days (in Dallas time).
  if (!offer.valid_days.includes(chicagoDayCode(now))) return false;

  // And the current Dallas time-of-day must be inside the daily window
  // (end is exclusive — 11:00 PM means closed at exactly 11:00 PM).
  return claimedAtInValidWindow(now, offer.valid_start_time, offer.valid_end_time);
}

export type OfferDisplayStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "ended"
  | "expired";

/**
 * The status to SHOW (vs the raw DB status). A published ('live') offer
 * only reads as "live" while it's actually inside its current window —
 * outside that window it's "scheduled" (it goes live again next window),
 * which mirrors what diners see (off-window offers are hidden). Ended
 * offers read "ended"; a non-recurring offer past its end date reads
 * "expired".
 */
export function offerDisplayStatus(
  offer: OfferAvailabilityInput & { status: string },
  now: Date = new Date(),
): OfferDisplayStatus {
  if (offer.status === "ended") return "ended";
  if (offer.ends_at && new Date(offer.ends_at) <= now) return "expired";
  if (offer.status === "live" && !isOfferAvailableNow(offer, now)) {
    return "scheduled";
  }
  return offer.status as OfferDisplayStatus;
}
