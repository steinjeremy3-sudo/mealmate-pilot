// A2 idempotency — webhook handlers replayed.
//
//   Stripe webhook ×2 (same event.id) → deduped via the stripe_events
//     table; the settlement transition happens once.
//   Dwolla webhook ×2 (same transfer) → the status='sent' guard means
//     the rebate transition happens once.

import crypto from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type FakeSchema } from "@/test-support/fake-supabase";

const h = vi.hoisted(() => ({
  fake: null as FakeSupabase | null,
  // Stripe: constructEvent returns this canned event (no real crypto).
  stripeEvent: {
    id: "evt_replay_1",
    type: "invoice.paid",
    data: { object: { id: "in_test_1" } },
  } as unknown,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => h.fake,
}));
vi.mock("@/lib/db/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/db/stripe-accounts", () => ({
  deriveStripeAccountStatus: () => "active",
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn(() => h.stripeEvent) } },
}));
vi.mock("@/lib/dwolla", () => ({
  dwolla: { get: vi.fn() },
}));

import { POST as dwollaPOST } from "./dwolla/route";
import { POST as stripePOST } from "./stripe/route";

const SCHEMA: FakeSchema = { unique: { stripe_events: [["id"]] } };

function fakeRequest(headers: Record<string, string>, body: string) {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    text: async () => body,
  } as unknown as Parameters<typeof stripePOST>[0];
}

describe("Stripe webhook — replay", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    h.fake = new FakeSupabase(
      {
        stripe_events: [],
        settlements: [
          { id: "s1", stripe_invoice_id: "in_test_1", status: "invoiced" },
        ],
      },
      SCHEMA,
    );
  });

  it("dedupes a replayed event and settles the invoice once", async () => {
    const body = JSON.stringify({ id: "evt_replay_1" });
    const req = () => fakeRequest({ "stripe-signature": "sig" }, body);

    const r1 = await stripePOST(req());
    expect(r1.status).toBe(200);

    const r2 = await stripePOST(req());
    expect(r2.status).toBe(200);

    // The event was recorded once; the second delivery short-circuits.
    expect(h.fake!.table("stripe_events")).toHaveLength(1);
    // The settlement moved to 'paid' and stayed there.
    expect(h.fake!.table("settlements")[0].status).toBe("paid");
  });
});

describe("Dwolla webhook — replay", () => {
  const SECRET = "dwolla_webhook_secret_test";
  const transferUrl = "https://api-sandbox.dwolla.com/transfers/txfr-1";

  beforeEach(() => {
    process.env.DWOLLA_WEBHOOK_SECRET = SECRET;
    h.fake = new FakeSupabase({
      rebates: [
        {
          id: "r1",
          provider_transfer_id: transferUrl,
          status: "sent",
          settled_at: null,
        },
      ],
    });
  });

  it("advances the rebate once when the event is replayed", async () => {
    const body = JSON.stringify({
      id: "whk_1",
      topic: "customer_transfer_completed",
      _links: { resource: { href: transferUrl } },
    });
    const sig = crypto
      .createHmac("sha256", SECRET)
      .update(body)
      .digest("hex");
    const req = () =>
      fakeRequest({ "x-request-signature-sha-256": sig }, body);

    const r1 = await dwollaPOST(req());
    expect(r1.status).toBe(200);
    expect(h.fake!.table("rebates")[0].status).toBe("settled");
    const settledAt = h.fake!.table("rebates")[0].settled_at;
    expect(settledAt).not.toBeNull();

    const r2 = await dwollaPOST(req());
    expect(r2.status).toBe(200);
    // The status='sent' guard means the replay matched no rows — the
    // rebate is still 'settled' and settled_at wasn't rewritten.
    expect(h.fake!.table("rebates")[0].status).toBe("settled");
    expect(h.fake!.table("rebates")[0].settled_at).toBe(settledAt);
    expect(h.fake!.table("rebates")).toHaveLength(1);
  });

  it("rejects a bad signature", async () => {
    const body = JSON.stringify({ id: "whk_x", topic: "x" });
    const res = await dwollaPOST(
      fakeRequest({ "x-request-signature-sha-256": "deadbeef" }, body),
    );
    expect(res.status).toBe(401);
  });
});
