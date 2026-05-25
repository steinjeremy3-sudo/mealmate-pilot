// Reject reasons for the match review queue. A plain module (not the
// "use server" actions file, which may only export async functions)
// so both the server action and the page UI can import it.

export const REJECT_REASONS = {
  wrong_restaurant: "Wrong restaurant",
  amount_mismatch: "Amount mismatch",
  outside_window: "Outside time window",
  diner_cancelled: "Diner cancelled",
  not_a_visit: "Not a Mealmate visit",
  other: "Other",
} as const;

export type RejectReason = keyof typeof REJECT_REASONS;
