// A2 idempotency — rebate creation + sending replayed.
//
//   createRebateForMatch ×2  → one rebate row (UNIQUE constraint)
//   sendInitiatedRebates ×2  → one Dwolla transfer (status guard)

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type FakeSchema } from "@/test-support/fake-supabase";

// Hoisted holders — vi.mock factories run before normal top-level
// code, so anything they reference must live inside vi.hoisted().
const h = vi.hoisted(() => ({
  fake: null as FakeSupabase | null,
  // Dwolla transfer mock — always "succeeds" with a canned URL.
  dwollaPost: vi.fn(async () => ({
    headers: {
      get: () => "https://api-sandbox.dwolla.com/transfers/txfr-1",
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => h.fake,
}));
vi.mock("@/lib/db/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/dwolla", () => ({
  dwolla: { post: h.dwollaPost },
  getMealMateBalanceFundingUrl: vi.fn(async () => "https://dwolla/fs/balance"),
  locationOf: (resp: { headers: { get: (k: string) => string | null } }) =>
    resp.headers.get("location"),
}));

import { createRebateForMatch } from "./issue";
import { sendInitiatedRebates } from "./send";

const SCHEMA: FakeSchema = {
  unique: {
    rebates: [["matched_transaction_id"]],
  },
  relations: {
    "rebates.plaid_card_accounts": {
      target: "plaid_card_accounts",
      localKey: "plaid_card_account_id",
    },
    "plaid_card_accounts.plaid_items": {
      target: "plaid_items",
      localKey: "plaid_item_id",
    },
  },
};

describe("createRebateForMatch — replay", () => {
  beforeEach(() => {
    h.fake = new FakeSupabase(
      {
        matched_transactions: [
          {
            id: "mt-1",
            plaid_card_account_id: "card-1",
            rebate_cents: 11500,
          },
        ],
        rebates: [],
      },
      SCHEMA,
    );
  });

  it("creates exactly one rebate when run twice on the same match", async () => {
    const first = await createRebateForMatch("mt-1");
    expect(first).not.toBeNull();
    expect(first?.status).toBe("initiated");

    const second = await createRebateForMatch("mt-1");
    // Idempotent: the UNIQUE(matched_transaction_id) collision is
    // swallowed and the helper reports "already exists".
    expect(second).toBeNull();

    expect(h.fake!.table("rebates")).toHaveLength(1);
  });
});

describe("sendInitiatedRebates — replay", () => {
  beforeEach(() => {
    h.dwollaPost.mockClear();
    h.fake = new FakeSupabase(
      {
        rebates: [
          {
            id: "reb-1",
            amount_cents: 11500,
            status: "initiated",
            plaid_card_account_id: "card-1",
            provider_transfer_id: null,
          },
        ],
        plaid_card_accounts: [{ id: "card-1", plaid_item_id: "item-1" }],
        plaid_items: [{ id: "item-1", user_id: "user-1" }],
        diner_dwolla_accounts: [
          {
            user_id: "user-1",
            default_card_funding_source_url: "https://dwolla/fs/diner",
          },
        ],
      },
      SCHEMA,
    );
  });

  it("issues exactly one Dwolla transfer when run twice", async () => {
    const first = await sendInitiatedRebates();
    expect(first.sent).toBe(1);
    expect(h.dwollaPost).toHaveBeenCalledTimes(1);

    const second = await sendInitiatedRebates();
    // The rebate is now 'sent'; the status='initiated' filter excludes
    // it, so the second run examines nothing and posts no transfer.
    expect(second.examined).toBe(0);
    expect(second.sent).toBe(0);
    expect(h.dwollaPost).toHaveBeenCalledTimes(1);

    const rebate = h.fake!.table("rebates")[0];
    expect(rebate.status).toBe("sent");
    expect(rebate.provider_transfer_id).toBe(
      "https://api-sandbox.dwolla.com/transfers/txfr-1",
    );
  });
});
