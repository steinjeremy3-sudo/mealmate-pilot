// Provider-error classification for Plaid, Dwolla, and Stripe.
//
// Each third-party SDK throws errors in its own shape. These pure
// functions normalize a thrown value into a ClassifiedError so call
// sites can branch on `disposition` instead of reverse-engineering
// SDK internals at every site.
//
// Disposition decides what the caller does:
//   retryable    — transient (rate limit, timeout, 5xx). Leave state
//                  untouched; the next cron run will retry.
//   user_action  — a diner/merchant must do something (re-auth a bank
//                  login, fix a declined card). Surface a message.
//   terminal     — a real, non-transient failure for THIS request
//                  (bad request, closed account). Mark it failed.
//   unexpected   — unrecognized. The caller should reportError() so a
//                  human investigates.
//
// Classifiers are pure + dependency-free (duck-typed on error shape)
// so they unit-test without constructing real SDK error objects.

import { reportError } from "./report";

export type ErrorDisposition =
  | "retryable"
  | "user_action"
  | "terminal"
  | "unexpected";

export type Provider = "plaid" | "dwolla" | "stripe";

export type ClassifiedError = {
  provider: Provider;
  /** Provider error code, or "UNKNOWN". */
  code: string;
  httpStatus: number | null;
  disposition: ErrorDisposition;
  /** Concise, safe-to-log summary. Never contains secrets. */
  message: string;
};

// ---------------------------------------------------------------- Plaid

// Plaid (axios-based) errors carry the API body on err.response.data:
//   { error_type, error_code, error_message, display_message }
const PLAID_DISPOSITION: Record<string, ErrorDisposition> = {
  RATE_LIMIT_EXCEEDED: "retryable",
  PRODUCT_NOT_READY: "retryable",
  INTERNAL_SERVER_ERROR: "retryable",
  PLANNED_MAINTENANCE: "retryable",
  ITEM_LOGIN_REQUIRED: "user_action",
  INVALID_CREDENTIALS: "user_action",
  INVALID_MFA: "user_action",
  ITEM_LOCKED: "user_action",
  ACCESS_NOT_GRANTED: "user_action",
  INVALID_ACCESS_TOKEN: "terminal",
  ITEM_NOT_FOUND: "terminal",
  INVALID_PRODUCT: "terminal",
  INVALID_FIELD: "terminal",
  INVALID_REQUEST: "terminal",
  PRODUCT_NOT_ENABLED: "terminal",
};

export function classifyPlaidError(err: unknown): ClassifiedError {
  const e = err as {
    response?: { status?: number; data?: { error_code?: string; error_message?: string } };
    code?: string;
    message?: string;
  };
  const httpStatus = e?.response?.status ?? null;
  const apiCode = e?.response?.data?.error_code;

  // No HTTP response at all → network/timeout.
  if (!e?.response) {
    return {
      provider: "plaid",
      code: e?.code === "ECONNABORTED" ? "TIMEOUT" : "NETWORK",
      httpStatus: null,
      disposition: "retryable",
      message: e?.message ?? "Plaid request did not complete",
    };
  }

  if (apiCode) {
    return {
      provider: "plaid",
      code: apiCode,
      httpStatus,
      disposition: PLAID_DISPOSITION[apiCode] ?? "unexpected",
      message:
        e?.response?.data?.error_message ?? `Plaid error ${apiCode}`,
    };
  }

  return {
    provider: "plaid",
    code: "UNKNOWN",
    httpStatus,
    disposition: "unexpected",
    message: e?.message ?? "Unrecognized Plaid error",
  };
}

// ---------------------------------------------------------------- Dwolla

// dwolla-v2 errors carry .status (HTTP) and .body ({ code, message }).
export function classifyDwollaError(err: unknown): ClassifiedError {
  const e = err as {
    status?: number;
    body?: { code?: string; message?: string };
    message?: string;
  };
  const httpStatus = e?.status ?? null;
  const code = e?.body?.code ?? null;
  const message = e?.body?.message ?? e?.message ?? "Dwolla request failed";

  if (httpStatus == null) {
    return {
      provider: "dwolla",
      code: "NETWORK",
      httpStatus: null,
      disposition: "retryable",
      message,
    };
  }
  if (httpStatus === 429 || httpStatus >= 500) {
    return {
      provider: "dwolla",
      code: code ?? String(httpStatus),
      httpStatus,
      disposition: "retryable",
      message,
    };
  }

  let disposition: ErrorDisposition;
  switch (code) {
    case "InsufficientFunds":
      // The Mealmate Dwolla balance is dry — ops must top it up.
      disposition = "unexpected";
      break;
    case "ValidationError":
    case "BadRequest":
    case "NotFound":
    case "Forbidden":
      disposition = "terminal";
      break;
    default:
      disposition = "unexpected";
  }
  return {
    provider: "dwolla",
    code: code ?? String(httpStatus),
    httpStatus,
    disposition,
    message,
  };
}

// ---------------------------------------------------------------- Stripe

// stripe-node throws Stripe.errors.* — each carries .type, .code,
// .statusCode. We duck-type on .type so this module needn't import
// the SDK.
const STRIPE_TYPE_DISPOSITION: Record<string, ErrorDisposition> = {
  StripeConnectionError: "retryable",
  StripeAPIError: "retryable",
  StripeRateLimitError: "retryable",
  StripeCardError: "user_action",
  StripeInvalidRequestError: "terminal",
  StripeIdempotencyError: "terminal",
  StripeAuthenticationError: "unexpected",
  StripePermissionError: "unexpected",
};

export function classifyStripeError(err: unknown): ClassifiedError {
  const e = err as {
    type?: string;
    code?: string;
    statusCode?: number;
    message?: string;
  };
  const type = e?.type;
  const httpStatus = e?.statusCode ?? null;

  if (!type) {
    return {
      provider: "stripe",
      code: "UNKNOWN",
      httpStatus,
      disposition: "unexpected",
      message: e?.message ?? "Unrecognized Stripe error",
    };
  }
  return {
    provider: "stripe",
    code: e?.code ?? type,
    httpStatus,
    disposition: STRIPE_TYPE_DISPOSITION[type] ?? "unexpected",
    message: e?.message ?? type,
  };
}

// ------------------------------------------------------------- dispatch

export function classifyProviderError(
  provider: Provider,
  err: unknown,
): ClassifiedError {
  switch (provider) {
    case "plaid":
      return classifyPlaidError(err);
    case "dwolla":
      return classifyDwollaError(err);
    case "stripe":
      return classifyStripeError(err);
  }
}

/**
 * Run an external-provider call with uniform A1 handling: classify any
 * thrown error, reportError() when it's unexpected, and re-throw a
 * clean classified Error. For call sites (mostly user-facing server
 * actions) that don't need bespoke per-disposition handling — those
 * that do (cron sync, rebate send) classify inline instead.
 */
export async function callExternal<T>(
  provider: Provider,
  scope: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const c = classifyProviderError(provider, err);
    if (c.disposition === "unexpected") {
      reportError({
        scope,
        message: c.message,
        meta: { code: c.code, httpStatus: c.httpStatus },
        cause: err,
      });
    }
    throw new Error(
      `${scope} failed [${c.provider}:${c.code}]: ${c.message}`,
    );
  }
}
