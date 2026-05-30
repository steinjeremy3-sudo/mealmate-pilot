import { describe, expect, it } from "vitest";

import { formatUsPhone, normalizeUsPhone } from "./phone";

describe("normalizeUsPhone", () => {
  it("normalizes a bare 10-digit number", () => {
    expect(normalizeUsPhone("2145551234")).toBe("+12145551234");
  });

  it("strips human formatting", () => {
    expect(normalizeUsPhone("(214) 555-1234")).toBe("+12145551234");
    expect(normalizeUsPhone("214.555.1234")).toBe("+12145551234");
    expect(normalizeUsPhone(" 214 555 1234 ")).toBe("+12145551234");
  });

  it("accepts a leading +1 / 1 country code", () => {
    expect(normalizeUsPhone("+1 214 555 1234")).toBe("+12145551234");
    expect(normalizeUsPhone("12145551234")).toBe("+12145551234");
  });

  it("rejects wrong-length numbers", () => {
    expect(normalizeUsPhone("555-1234")).toBeNull();
    expect(normalizeUsPhone("214555123")).toBeNull(); // 9 digits
    expect(normalizeUsPhone("2145551234567")).toBeNull(); // too long
    expect(normalizeUsPhone("")).toBeNull();
  });

  it("rejects an area code starting with 0 or 1", () => {
    expect(normalizeUsPhone("0145551234")).toBeNull();
    expect(normalizeUsPhone("1145551234")).toBeNull();
  });
});

describe("formatUsPhone", () => {
  it("formats an E.164 US number", () => {
    expect(formatUsPhone("+12145551234")).toBe("+1 (214) 555-1234");
  });

  it("passes through anything unexpected", () => {
    expect(formatUsPhone("+447700900000")).toBe("+447700900000");
  });
});
