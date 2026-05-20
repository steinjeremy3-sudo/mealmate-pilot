// A2 idempotency — the weekly settlement run replayed.
//
//   runWeeklySettlement ×2 → one settlement row, one Stripe invoice.
//   The second run finds nothing because the transactions were
//   claimed (settlement_id set) by the first.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type FakeSchema } from "@/test-support/fake-supabase";

const h = vi.hoisted(() => ({
  fake: null as FakeSupabase | null,
  invoiceCreate: vi.fn(async () => ({ id: "in_test_1" })),
  invoiceItemCreate: vi.fn(async () => ({})),
  finalizeInvoice: vi.fn(async () => ({})),
  sendInvoice: vi.fn(async () => ({})),
  customerCreate: vi.fn(async () => ({ id: "cus_test_1" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => h.fake,
}));
vi.mock("@/lib/db/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    invoices: {
      create: h.invoiceCreate,
      finalizeInvoice: h.finalizeInvoice,
      sendInvoice: h.sendInvoice,
    },
    invoiceItems: { create: h.invoiceItemCreate },
    customers: { create: h.customerCreate },
  },
}));

import { runWeeklySettlement } from "./run";

const SCHEMA: FakeSchema = {
  relations: {
    "restaurants.users": { target: "users", localKey: "owner_user_id" },
  },
};

describe("runWeeklySettlement — replay", () => {
  beforeEach(() => {
    h.invoiceCreate.mockClear();
    h.fake = new FakeSupabase(
      {
        matched_transactions: [
          {
            id: "mt-1",
            restaurant_id: "rest-1",
            discount_cents: 12500,
            auto_approval_status: "auto_approved",
            settlement_id: null,
          },
        ],
        restaurants: [
          { id: "rest-1", name: "KFC", owner_user_id: "owner-1" },
        ],
        users: [{ id: "owner-1", email: "owner@example.com" }],
        settlements: [],
        restaurant_billing_customers: [],
      },
      SCHEMA,
    );
  });

  it("creates one settlement + one invoice across two runs", async () => {
    const first = await runWeeklySettlement();
    expect(first.restaurantsSettled).toBe(1);
    expect(first.invoicesCreated).toBe(1);
    expect(h.invoiceCreate).toHaveBeenCalledTimes(1);

    const matched = h.fake!.table("matched_transactions")[0];
    expect(matched.settlement_id).not.toBeNull();

    const second = await runWeeklySettlement();
    // The transaction was claimed (settlement_id set) by run 1, so the
    // settlement_id-IS-NULL filter excludes it — nothing to settle.
    expect(second.restaurantsSettled).toBe(0);
    expect(second.invoicesCreated).toBe(0);
    expect(h.invoiceCreate).toHaveBeenCalledTimes(1);

    expect(h.fake!.table("settlements")).toHaveLength(1);
  });
});
