import { describe, expect, it } from "vitest";

import { isOfferAvailableNow } from "./availability";

// A daily 5:00 PM–11:00 PM offer, valid every day, open run window.
function dinnerOffer(overrides = {}) {
  return {
    valid_days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    valid_start_time: "17:00:00",
    valid_end_time: "23:00:00",
    starts_at: null,
    ends_at: null,
    ...overrides,
  };
}

// May → Chicago is CDT (UTC-5).
describe("isOfferAvailableNow", () => {
  it("is available inside the daily window", () => {
    // 2026-05-19T23:30Z = 6:30 PM CDT Tuesday — inside 5–11 PM.
    expect(isOfferAvailableNow(dinnerOffer(), new Date("2026-05-19T23:30:00Z"))).toBe(true);
  });

  it("is NOT available after the window closes (the reported bug)", () => {
    // 2026-05-20T04:30Z = 11:30 PM CDT Tuesday — past the 11 PM close.
    expect(isOfferAvailableNow(dinnerOffer(), new Date("2026-05-20T04:30:00Z"))).toBe(false);
  });

  it("treats the end time as exclusive (closed at exactly 11 PM)", () => {
    // 2026-05-20T04:00Z = 11:00 PM CDT.
    expect(isOfferAvailableNow(dinnerOffer(), new Date("2026-05-20T04:00:00Z"))).toBe(false);
  });

  it("is NOT available before the window opens", () => {
    // 2026-05-19T20:00Z = 3:00 PM CDT — before the 5 PM open.
    expect(isOfferAvailableNow(dinnerOffer(), new Date("2026-05-19T20:00:00Z"))).toBe(false);
  });

  it("is NOT available on a day outside valid_days", () => {
    // 2026-05-19 is a Tuesday; offer only runs Friday.
    const friOnly = dinnerOffer({ valid_days: ["fri"] });
    expect(isOfferAvailableNow(friOnly, new Date("2026-05-19T23:30:00Z"))).toBe(false);
  });

  it("is NOT available once the overall run has ended", () => {
    const ended = dinnerOffer({ ends_at: "2026-05-18T00:00:00Z" });
    expect(isOfferAvailableNow(ended, new Date("2026-05-19T23:30:00Z"))).toBe(false);
  });

  it("is NOT available before the run starts", () => {
    const future = dinnerOffer({ starts_at: "2026-06-01T00:00:00Z" });
    expect(isOfferAvailableNow(future, new Date("2026-05-19T23:30:00Z"))).toBe(false);
  });
});
