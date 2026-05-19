// Sandbox-only seed. Adds the merchants that Plaid sandbox returns
// naturally (KFC, McDonald's) as Dallas restaurants in our DB, plus a
// live offer for each. This unlocks end-to-end matching in sandbox
// without needing Plaid's sandboxTransactionsCreate injection.
//
// All seeded ids use the FFF... UUID prefix so they're trivially
// distinguishable from canon production seed (which uses 000...).
//
// Idempotent: upserts on id. Re-running this is safe.
//
// **DO NOT** run against production. The KFC/McDonald's rows would
// show up as live offers in the diner browse.
//
// Usage: `npm run seed:sandbox`

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.",
  );
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OWNER_EMAIL = "sandbox-test-owner@mealmate.seed.local";

type SandboxRestaurant = {
  id: string;
  name: string;
  cuisine: string;
};

const SANDBOX_RESTAURANTS: SandboxRestaurant[] = [
  {
    id: "ffffffff-0000-0000-0000-000000000001",
    name: "KFC",
    cuisine: "Fried chicken",
  },
  {
    id: "ffffffff-0000-0000-0000-000000000002",
    name: "McDonald's",
    cuisine: "Burgers",
  },
  {
    id: "ffffffff-0000-0000-0000-000000000003",
    name: "Starbucks",
    cuisine: "Coffee",
  },
];

type SandboxOffer = {
  id: string;
  restaurantId: string;
  title: string;
  discountPct: number;
};

const SANDBOX_OFFERS: SandboxOffer[] = [
  {
    id: "ffffffff-0000-0000-0000-100000000001",
    restaurantId: "ffffffff-0000-0000-0000-000000000001",
    title: "25% off sandbox chicken",
    discountPct: 25,
  },
  {
    id: "ffffffff-0000-0000-0000-100000000002",
    restaurantId: "ffffffff-0000-0000-0000-000000000002",
    title: "20% off sandbox burgers",
    discountPct: 20,
  },
  {
    id: "ffffffff-0000-0000-0000-100000000003",
    restaurantId: "ffffffff-0000-0000-0000-000000000003",
    title: "15% off sandbox coffee",
    discountPct: 15,
  },
];

async function ensureOwnerUser(): Promise<string> {
  // Find or create the merchant user that "owns" the sandbox rows.
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", OWNER_EMAIL)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: OWNER_EMAIL,
    email_confirm: true,
    user_metadata: { display_name: "Sandbox Test Owner" },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  const userId = created.user?.id;
  if (!userId) throw new Error("createUser returned no id");

  // The handle_new_user trigger should auto-insert a users row with
  // role='diner'. Flip to 'merchant'.
  await supabase
    .from("users")
    .update({ role: "merchant", display_name: "Sandbox Test Owner" })
    .eq("id", userId);

  return userId;
}

async function main() {
  const ownerId = await ensureOwnerUser();
  console.log(`Sandbox owner user: ${ownerId}`);

  // Upsert restaurants (approved, MCC 5812 sit-down).
  for (const r of SANDBOX_RESTAURANTS) {
    const { error } = await supabase.from("restaurants").upsert(
      {
        id: r.id,
        owner_user_id: ownerId,
        name: r.name,
        address: "Sandbox Address",
        neighborhood: "Bishop Arts",
        city: "Dallas",
        cuisine: r.cuisine,
        mcc: "5812",
        status: "approved",
      },
      { onConflict: "id" },
    );
    if (error) {
      console.error(`upsert restaurant ${r.name}:`, error);
    } else {
      console.log(`✓ restaurant: ${r.name}`);
    }
  }

  // Upsert offers. Active, generous windows so the rubric passes
  // regardless of when the e2e test runs.
  for (const o of SANDBOX_OFFERS) {
    const { error } = await supabase.from("offers").upsert(
      {
        id: o.id,
        restaurant_id: o.restaurantId,
        title: o.title,
        description: "Sandbox-only offer for Phase 4d e2e validation.",
        discount_pct: o.discountPct,
        min_check_cents: 0,
        monthly_budget_cents: 1000000,
        monthly_spent_cents: 0,
        max_claims_per_diner: 10,
        valid_days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
        valid_start_time: "00:00",
        valid_end_time: "23:59",
        starts_at: new Date("2026-01-01").toISOString(),
        status: "live",
      },
      { onConflict: "id" },
    );
    if (error) {
      console.error(`upsert offer ${o.title}:`, error);
    } else {
      console.log(`✓ offer: ${o.title}`);
    }
  }

  console.log("\nDone. Visit /app to claim a sandbox offer.");
  process.exit(0);
}

void main();
