// Cash-back payout configuration.

/**
 * Whether the debit-card (Astra push-to-card) payout rail is offered
 * to diners.
 *
 * OFF for the pilot. Two things must BOTH be true before flipping this
 * to `true`, or a diner who picks debit gets stranded with cash back
 * that can never pay out:
 *
 *   1. Astra must enable "debit functionality" on our account (a
 *      vendor-side capability they configure manually — still blocked
 *      as of this writing; see the push-to-debit project notes).
 *   2. The send rail must actually ROUTE to Astra. Today
 *      src/lib/rebates/issue.ts hardcodes provider:"dwolla" and
 *      src/lib/rebates/send.ts only reads diner_dwolla_accounts — it
 *      never branches on users.payout_method. So even a diner with a
 *      linked Astra card would have their rebate created as Dwolla and
 *      then skipped (no Dwolla destination) forever.
 *
 * Until then the diner-facing chooser is ACH-only (Dwolla), which pays
 * out for real. The Astra setup routes are guarded on this flag so a
 * bookmarked/typed URL can't reach a dead end either.
 */
export const DEBIT_PAYOUT_ENABLED = false;
