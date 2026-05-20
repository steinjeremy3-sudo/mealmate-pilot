import { describe, expect, it } from "vitest";

import {
  classifyDwollaError,
  classifyPlaidError,
  classifyProviderError,
  classifyStripeError,
} from "./provider-errors";

describe("classifyPlaidError", () => {
  const plaidErr = (status: number, code: string) => ({
    response: { status, data: { error_code: code, error_message: `msg ${code}` } },
  });

  it("rate limit → retryable", () => {
    expect(classifyPlaidError(plaidErr(429, "RATE_LIMIT_EXCEEDED")).disposition).toBe(
      "retryable",
    );
  });
  it("PRODUCT_NOT_READY → retryable", () => {
    expect(classifyPlaidError(plaidErr(400, "PRODUCT_NOT_READY")).disposition).toBe(
      "retryable",
    );
  });
  it("ITEM_LOGIN_REQUIRED → user_action", () => {
    expect(
      classifyPlaidError(plaidErr(400, "ITEM_LOGIN_REQUIRED")).disposition,
    ).toBe("user_action");
  });
  it("INVALID_PRODUCT → terminal", () => {
    expect(classifyPlaidError(plaidErr(400, "INVALID_PRODUCT")).disposition).toBe(
      "terminal",
    );
  });
  it("unrecognized code → unexpected", () => {
    expect(
      classifyPlaidError(plaidErr(400, "SOME_BRAND_NEW_CODE")).disposition,
    ).toBe("unexpected");
  });
  it("no response (network) → retryable, NETWORK", () => {
    const c = classifyPlaidError({ message: "socket hang up" });
    expect(c.disposition).toBe("retryable");
    expect(c.code).toBe("NETWORK");
  });
  it("ECONNABORTED → retryable, TIMEOUT", () => {
    const c = classifyPlaidError({ code: "ECONNABORTED", message: "timeout" });
    expect(c.code).toBe("TIMEOUT");
    expect(c.disposition).toBe("retryable");
  });
  it("never throws on a bare error", () => {
    expect(() => classifyPlaidError(new Error("boom"))).not.toThrow();
    expect(classifyPlaidError(new Error("boom")).disposition).toBe("retryable");
  });
});

describe("classifyDwollaError", () => {
  it("429 → retryable", () => {
    expect(
      classifyDwollaError({ status: 429, body: { code: "TooManyRequests" } })
        .disposition,
    ).toBe("retryable");
  });
  it("5xx → retryable", () => {
    expect(
      classifyDwollaError({ status: 503, body: { code: "ServerError" } })
        .disposition,
    ).toBe("retryable");
  });
  it("InsufficientFunds → unexpected (ops must fund the balance)", () => {
    expect(
      classifyDwollaError({ status: 400, body: { code: "InsufficientFunds" } })
        .disposition,
    ).toBe("unexpected");
  });
  it("ValidationError → terminal", () => {
    expect(
      classifyDwollaError({ status: 400, body: { code: "ValidationError" } })
        .disposition,
    ).toBe("terminal");
  });
  it("no status (network) → retryable", () => {
    expect(classifyDwollaError({ message: "ETIMEDOUT" }).disposition).toBe(
      "retryable",
    );
  });
});

describe("classifyStripeError", () => {
  it("StripeConnectionError → retryable", () => {
    expect(
      classifyStripeError({ type: "StripeConnectionError", statusCode: 0 })
        .disposition,
    ).toBe("retryable");
  });
  it("StripeRateLimitError → retryable", () => {
    expect(
      classifyStripeError({ type: "StripeRateLimitError", statusCode: 429 })
        .disposition,
    ).toBe("retryable");
  });
  it("StripeCardError → user_action", () => {
    expect(
      classifyStripeError({ type: "StripeCardError", code: "card_declined" })
        .disposition,
    ).toBe("user_action");
  });
  it("StripeInvalidRequestError → terminal", () => {
    expect(
      classifyStripeError({ type: "StripeInvalidRequestError" }).disposition,
    ).toBe("terminal");
  });
  it("StripeAuthenticationError → unexpected", () => {
    expect(
      classifyStripeError({ type: "StripeAuthenticationError" }).disposition,
    ).toBe("unexpected");
  });
  it("no type → unexpected", () => {
    expect(classifyStripeError({ message: "???" }).disposition).toBe(
      "unexpected",
    );
  });
});

describe("classifyProviderError dispatch", () => {
  it("routes to the right classifier", () => {
    expect(classifyProviderError("plaid", {}).provider).toBe("plaid");
    expect(classifyProviderError("dwolla", {}).provider).toBe("dwolla");
    expect(classifyProviderError("stripe", {}).provider).toBe("stripe");
  });
});
