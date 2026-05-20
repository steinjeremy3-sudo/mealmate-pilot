// A2 idempotency — the matcher replayed.
//
//   matchPendingTransactions ×2 → the transaction is matched once;
//   the second run examines nothing because the row is no longer
//   match_confidence='none'.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type FakeSchema } from "@/test-support/fake-supabase";

const h = vi.hoisted(() => ({ fake: null as FakeSupabase | null }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => h.fake,
}));
vi.mock("@/lib/db/audit-log", () => ({ logAuditEvent: vi.fn() }));

import { matchPendingTransactions } from "./match";

const SCHEMA: FakeSchema = {
  relations: {
    "plaid_card_accounts.plaid_items": {
      target: "plaid_items",
      localKey: "plaid_item_id",
    },
    "claims.offers": { target: "offers", localKey: "offer_id" },
  },
};

describe("matchPendingTransactions — replay", () => {
  beforeEach(() => {
    h.fake = new FakeSupabase(
      {
        matched_transactions: [
          {
            id: "mt-1",
            plaid_card_account_id: "card-1",
            merchant_name_raw: "KFC",
            merchant_name_normalized: "kfc",
            amount_cents: 8700,
            transaction_date: "2026-05-20",
            match_confidence: "none",
            restaurant_id: null,
            claim_id: null,
          },
        ],
        restaurants: [
          {
            id: "rest-1",
            name: "KFC",
            city: "Dallas",
            mcc: "5812",
            status: "approved",
          },
        ],
        plaid_card_accounts: [{ id: "card-1", plaid_item_id: "item-1" }],
        plaid_items: [{ id: "item-1", user_id: "user-1" }],
        claims: [
          {
            id: "claim-1",
            diner_user_id: "user-1",
            claimed_at: "2026-05-20T18:00:00Z",
            status: "claimed",
            offer_id: "offer-1",
          },
        ],
        offers: [
          { id: "offer-1", restaurant_id: "rest-1", min_check_cents: 5000 },
        ],
      },
      SCHEMA,
    );
  });

  it("matches the transaction once across two runs", async () => {
    const first = await matchPendingTransactions();
    expect(first.examined).toBe(1);
    // KFC txn + KFC restaurant + a same-day claim → a confident match.
    expect(first.matchedHigh + first.matchedMedium).toBe(1);

    const matched = h.fake!.table("matched_transactions")[0];
    expect(matched.restaurant_id).toBe("rest-1");
    expect(matched.match_confidence).not.toBe("none");

    const second = await matchPendingTransactions();
    // The row is no longer match_confidence='none' → not re-examined.
    expect(second.examined).toBe(0);

    // The matcher only ever updates in place — never a second row.
    expect(h.fake!.table("matched_transactions")).toHaveLength(1);
  });
});
