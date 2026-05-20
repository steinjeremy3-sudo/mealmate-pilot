import { describe, expect, it } from "vitest";

import { FakeSupabase } from "./fake-supabase";

describe("FakeSupabase — core CRUD", () => {
  it("inserts and selects back", async () => {
    const db = new FakeSupabase({ widgets: [] });
    await db.from("widgets").insert({ id: "w1", name: "A" });
    const { data } = await db.from("widgets").select("*");
    expect(data).toEqual([{ id: "w1", name: "A" }]);
  });

  it("auto-generates an id when none is given", async () => {
    const db = new FakeSupabase({ widgets: [] });
    const { data } = await db
      .from("widgets")
      .insert({ name: "A" })
      .select("id")
      .single();
    expect((data as { id: string }).id).toMatch(/^fake-id-/);
  });

  it("enforces UNIQUE — replayed insert returns 23505", async () => {
    const db = new FakeSupabase(
      { events: [] },
      { unique: { events: [["event_id"]] } },
    );
    const first = await db.from("events").insert({ event_id: "evt_1" });
    expect(first.error).toBeNull();
    const replay = await db.from("events").insert({ event_id: "evt_1" });
    expect(replay.error?.code).toBe("23505");
    expect(db.table("events")).toHaveLength(1);
  });

  it("upsert: inserts when new, updates when the conflict key exists", async () => {
    const db = new FakeSupabase({ accts: [] });
    await db.from("accts").upsert(
      { user_id: "u1", name: "first" },
      { onConflict: "user_id" },
    );
    await db.from("accts").upsert(
      { user_id: "u1", name: "second" },
      { onConflict: "user_id" },
    );
    expect(db.table("accts")).toHaveLength(1);
    expect(db.table("accts")[0].name).toBe("second");
  });

  it("update applies a patch to filtered rows only", async () => {
    const db = new FakeSupabase({
      jobs: [
        { id: "j1", status: "initiated" },
        { id: "j2", status: "initiated" },
      ],
    });
    await db.from("jobs").update({ status: "sent" }).eq("id", "j1");
    expect(db.table("jobs").find((r) => r.id === "j1")?.status).toBe("sent");
    expect(db.table("jobs").find((r) => r.id === "j2")?.status).toBe(
      "initiated",
    );
  });

  it("update guarded by status only affects rows still in that status", async () => {
    const db = new FakeSupabase({ jobs: [{ id: "j1", status: "sent" }] });
    // Replaying an 'initiated'-guarded update after the row moved on
    // is a no-op — the idempotency pattern our handlers rely on.
    const { data } = await db
      .from("jobs")
      .update({ status: "settled" })
      .eq("id", "j1")
      .eq("status", "initiated")
      .select("id");
    expect(data).toEqual([]);
    expect(db.table("jobs")[0].status).toBe("sent");
  });
});

describe("FakeSupabase — filters", () => {
  const seed = {
    rows: [
      { id: "1", kind: "a", n: 10, ref: null },
      { id: "2", kind: "b", n: 20, ref: "x" },
      { id: "3", kind: "a", n: 30, ref: null },
    ],
  };

  it("eq / in / is / not-is / gte", async () => {
    const db = () => new FakeSupabase(seed);
    expect(((await db().from("rows").select("*").eq("kind", "a")).data as unknown[]))
      .toHaveLength(2);
    expect(((await db().from("rows").select("*").in("id", ["1", "2"])).data as unknown[]))
      .toHaveLength(2);
    expect(((await db().from("rows").select("*").is("ref", null)).data as unknown[]))
      .toHaveLength(2);
    expect(
      ((await db().from("rows").select("*").not("ref", "is", null)).data as unknown[]),
    ).toHaveLength(1);
    expect(((await db().from("rows").select("*").gte("n", 20)).data as unknown[]))
      .toHaveLength(2);
  });

  it("order + limit", async () => {
    const db = new FakeSupabase(seed);
    const { data } = await db
      .from("rows")
      .select("*")
      .order("n", { ascending: false })
      .limit(1);
    expect((data as { n: number }[])[0].n).toBe(30);
  });

  it("maybeSingle returns null when nothing matches", async () => {
    const db = new FakeSupabase(seed);
    const { data } = await db
      .from("rows")
      .select("*")
      .eq("id", "nope")
      .maybeSingle();
    expect(data).toBeNull();
  });
});

describe("FakeSupabase — embedded joins", () => {
  const schema = {
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
  const seed = {
    rebates: [
      { id: "r1", plaid_card_account_id: "c1" },
      { id: "r2", plaid_card_account_id: "orphan" },
    ],
    plaid_card_accounts: [{ id: "c1", plaid_item_id: "i1" }],
    plaid_items: [{ id: "i1", user_id: "u1" }],
  };

  it("resolves a nested to-one join", async () => {
    const db = new FakeSupabase(seed, schema);
    const { data } = await db
      .from("rebates")
      .select("id, plaid_card_accounts ( plaid_items ( user_id ) )")
      .eq("id", "r1")
      .single();
    const row = data as { plaid_card_accounts: { plaid_items: { user_id: string } } };
    expect(row.plaid_card_accounts.plaid_items.user_id).toBe("u1");
  });

  it("!inner drops rows whose embed is missing", async () => {
    const db = new FakeSupabase(seed, schema);
    const { data } = await db
      .from("rebates")
      .select("id, plaid_card_accounts!inner ( plaid_items!inner ( user_id ) )");
    // r2 references a card that doesn't exist → excluded by !inner.
    expect((data as unknown[])).toHaveLength(1);
    expect((data as { id: string }[])[0].id).toBe("r1");
  });

  it("filters on a dotted joined path", async () => {
    const db = new FakeSupabase(seed, schema);
    const { data } = await db
      .from("rebates")
      .select("id, plaid_card_accounts!inner ( plaid_items!inner ( user_id ) )")
      .eq("plaid_card_accounts.plaid_items.user_id", "u1");
    expect((data as unknown[])).toHaveLength(1);
  });
});
