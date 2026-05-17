import { describe, expect, it } from "vitest";

import { centsToUsd, usdToCents } from "./money";

describe("centsToUsd", () => {
  it("formats whole-dollar amounts", () => {
    expect(centsToUsd(0)).toBe("$0.00");
    expect(centsToUsd(100)).toBe("$1.00");
    expect(centsToUsd(123400)).toBe("$1234.00");
  });

  it("formats cents amounts", () => {
    expect(centsToUsd(99)).toBe("$0.99");
    expect(centsToUsd(1234)).toBe("$12.34");
  });
});

describe("usdToCents", () => {
  it("converts whole dollars", () => {
    expect(usdToCents(1)).toBe(100);
    expect(usdToCents(12.34)).toBe(1234);
  });

  it("rounds to the nearest cent", () => {
    expect(usdToCents(0.005)).toBe(1); // standard round-half-up
    expect(usdToCents(0.014)).toBe(1);
    expect(usdToCents(0.016)).toBe(2);
  });
});
