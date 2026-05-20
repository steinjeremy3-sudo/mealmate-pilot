// reportError — the single alerting seam for the whole app.
//
// Right now it emits a loud, structured console.error tagged `[ALERT]`.
// Track A4 (monitoring) will swap THIS FUNCTION BODY for Sentry
// captureException + a Slack webhook — every call site already routes
// through here, so A4 is a one-function change, not an app-wide edit.
//
// Call reportError for genuinely unexpected failures — the ones a
// human needs to look at. Known/handled conditions (a diner needs to
// re-auth, a transient rate-limit) should NOT call this; they're
// normal operation and use console.warn via the classifier path.

export type ReportContext = {
  /** Dotted scope, e.g. "plaid.transactionsSync" or "cron.weekly-settlement". */
  scope: string;
  /** One-line human summary of what went wrong. */
  message: string;
  /** Structured context to debug from — ids, counts, codes. No secrets. */
  meta?: Record<string, unknown>;
  /** The underlying thrown value, if any. */
  cause?: unknown;
};

export function reportError(ctx: ReportContext): void {
  const causeSummary =
    ctx.cause instanceof Error
      ? `${ctx.cause.name}: ${ctx.cause.message}`
      : ctx.cause !== undefined
        ? String(ctx.cause)
        : undefined;

  // A4: replace this block with Sentry.captureException(ctx.cause ?? …)
  // + a Slack webhook post. Keep the shape — call sites depend on it.
  console.error(
    `[ALERT] ${ctx.scope}: ${ctx.message}`,
    JSON.stringify({ ...ctx.meta, cause: causeSummary }),
  );
}
