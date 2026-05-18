// Seed canon data: 8 Dallas restaurants (Lucia + 7 others) and one
// live offer per restaurant. Owners are seeded via Supabase Auth admin
// API with `@mealmate.seed.local` emails so they can't actually sign in
// — they exist only to satisfy the owner_user_id FK on restaurants.
//
// Idempotent. Restaurants and offers use deterministic UUIDs and are
// upserted by id. Re-running this script after the first time:
//   - looks up existing merchant users by email (no duplicate creation)
//   - upserts restaurants / offers (no duplicates, latest fields win)
//
// Uses the service-role admin client to bypass RLS. NEVER run against
// a production DB once real users exist — every seeded user / restaurant
// shares its UUID across deployments, so the seed is meant for the
// pilot-prep environment.
//
// Usage: `npm run seed`

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

// ----------------------------------------------------------------
// Seed data
// ----------------------------------------------------------------
type SeedRestaurant = {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  cuisine: string;
  ownerEmail: string;
  ownerName: string;
};

const RESTAURANTS: SeedRestaurant[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Lucia",
    address: "408 N Bishop Ave",
    neighborhood: "Bishop Arts",
    cuisine: "Italian",
    ownerEmail: "dario@mealmate.seed.local",
    ownerName: "Dario Morelli",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Veracruz Cocina",
    address: "408 W Davis St",
    neighborhood: "Bishop Arts",
    cuisine: "Mexican",
    ownerEmail: "maria@mealmate.seed.local",
    ownerName: "Maria Ortega",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Smoke & Tinder",
    address: "2702 Main St",
    neighborhood: "Deep Ellum",
    cuisine: "BBQ",
    ownerEmail: "carla@mealmate.seed.local",
    ownerName: "Carla Doss",
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "Trompo East",
    address: "2812 Elm St",
    neighborhood: "Deep Ellum",
    cuisine: "Tacos",
    ownerEmail: "luis@mealmate.seed.local",
    ownerName: "Luis Olvera",
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    name: "Wendigo Cellar",
    address: "3211 Knox St",
    neighborhood: "Knox-Henderson",
    cuisine: "Wine bar",
    ownerEmail: "hannah@mealmate.seed.local",
    ownerName: "Hannah Park",
  },
  {
    id: "00000000-0000-0000-0000-000000000006",
    name: "The Lemon Tree",
    address: "2929 N Henderson Ave",
    neighborhood: "Knox-Henderson",
    cuisine: "Mediterranean",
    ownerEmail: "yusuf@mealmate.seed.local",
    ownerName: "Yusuf Demir",
  },
  {
    id: "00000000-0000-0000-0000-000000000007",
    name: "Anchovy & Roe",
    address: "1818 Lower Greenville Ave",
    neighborhood: "Lower Greenville",
    cuisine: "Seafood",
    ownerEmail: "skye@mealmate.seed.local",
    ownerName: "Skye Brennan",
  },
  {
    id: "00000000-0000-0000-0000-000000000008",
    name: "Tropico",
    address: "1900 Greenville Ave",
    neighborhood: "Lower Greenville",
    cuisine: "Latin fusion",
    ownerEmail: "camila@mealmate.seed.local",
    ownerName: "Camila Reyes",
  },
];

type SeedOffer = {
  id: string;
  restaurantId: string;
  title: string;
  description: string;
  discountPct: number;
  minSpendCents: number;
  validDays: string[];
  validStartTime: string;
  validEndTime: string;
};

// Mix of days, hours, and discount levels so demos can exercise the
// rubric. Lucia is the canon hero offer (25% off dinner Tue–Thu).
const OFFERS: SeedOffer[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    restaurantId: "00000000-0000-0000-0000-000000000001",
    title: "25% off dinner",
    description: "Enjoy 25% off your check, Tuesday through Thursday dinner.",
    discountPct: 25,
    minSpendCents: 0,
    validDays: ["tue", "wed", "thu"],
    validStartTime: "17:00",
    validEndTime: "22:00",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    restaurantId: "00000000-0000-0000-0000-000000000002",
    title: "20% off lunch",
    description: "Cantina lunch, Monday through Friday, 20% off your order.",
    discountPct: 20,
    minSpendCents: 1500,
    validDays: ["mon", "tue", "wed", "thu", "fri"],
    validStartTime: "11:00",
    validEndTime: "14:00",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    restaurantId: "00000000-0000-0000-0000-000000000003",
    title: "30% off Sunday BBQ",
    description: "Brisket, ribs, and sides. Sundays only.",
    discountPct: 30,
    minSpendCents: 2500,
    validDays: ["sun"],
    validStartTime: "12:00",
    validEndTime: "21:00",
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    restaurantId: "00000000-0000-0000-0000-000000000004",
    title: "15% off taco trios",
    description: "Any trio of tacos, all week, 15% off.",
    discountPct: 15,
    minSpendCents: 0,
    validDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    validStartTime: "11:00",
    validEndTime: "23:00",
  },
  {
    id: "10000000-0000-0000-0000-000000000005",
    restaurantId: "00000000-0000-0000-0000-000000000005",
    title: "Half-price wine flights",
    description: "Tuesday flights, 5pm–9pm only.",
    discountPct: 50,
    minSpendCents: 1500,
    validDays: ["tue"],
    validStartTime: "17:00",
    validEndTime: "21:00",
  },
  {
    id: "10000000-0000-0000-0000-000000000006",
    restaurantId: "00000000-0000-0000-0000-000000000006",
    title: "25% off mezze platters",
    description: "Mid-week mezze. Wed and Thu, dinner only.",
    discountPct: 25,
    minSpendCents: 2000,
    validDays: ["wed", "thu"],
    validStartTime: "17:00",
    validEndTime: "22:00",
  },
  {
    id: "10000000-0000-0000-0000-000000000007",
    restaurantId: "00000000-0000-0000-0000-000000000007",
    title: "20% off raw bar",
    description: "Oysters, crudo, ceviche. Mon–Wed evening.",
    discountPct: 20,
    minSpendCents: 1800,
    validDays: ["mon", "tue", "wed"],
    validStartTime: "17:00",
    validEndTime: "22:00",
  },
  {
    id: "10000000-0000-0000-0000-000000000008",
    restaurantId: "00000000-0000-0000-0000-000000000008",
    title: "30% off small plates",
    description: "Thu–Sat happy hour, 30% off the small plates menu.",
    discountPct: 30,
    minSpendCents: 1000,
    validDays: ["thu", "fri", "sat"],
    validStartTime: "16:00",
    validEndTime: "19:00",
  },
];

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/**
 * Look up the owner in public.users by email; if missing, create them
 * via Supabase Auth admin API. The handle_new_user trigger mirrors the
 * new auth.users row into public.users with role=merchant.
 */
async function getOrCreateOwner(email: string, name: string): Promise<string> {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: "merchant", display_name: name },
  });
  if (error || !data.user) {
    throw new Error(`createUser(${email}) failed: ${error?.message ?? "unknown"}`);
  }
  return data.user.id;
}

// ----------------------------------------------------------------
// Main
// ----------------------------------------------------------------
async function main() {
  console.log(`Seeding ${RESTAURANTS.length} restaurants + ${OFFERS.length} offers...`);

  for (const r of RESTAURANTS) {
    const ownerId = await getOrCreateOwner(r.ownerEmail, r.ownerName);

    const { error } = await supabase.from("restaurants").upsert({
      id: r.id,
      owner_user_id: ownerId,
      name: r.name,
      address: r.address,
      neighborhood: r.neighborhood,
      city: "Dallas",
      cuisine: r.cuisine,
      mcc: "5812",
      status: "approved",
    });
    if (error) throw new Error(`restaurant ${r.name}: ${error.message}`);
    console.log(`  restaurant: ${r.name.padEnd(20)} (owner: ${r.ownerName})`);
  }

  // starts_at = yesterday so every seeded offer is immediately discoverable.
  const startsAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const o of OFFERS) {
    const { error } = await supabase.from("offers").upsert({
      id: o.id,
      restaurant_id: o.restaurantId,
      title: o.title,
      description: o.description,
      discount_pct: o.discountPct,
      min_spend_cents: o.minSpendCents,
      valid_days: o.validDays,
      valid_start_time: o.validStartTime,
      valid_end_time: o.validEndTime,
      max_claims_per_diner: 1,
      status: "live",
      starts_at: startsAt,
      ends_at: null,
    });
    if (error) throw new Error(`offer ${o.title}: ${error.message}`);
    console.log(`  offer: ${o.title}`);
  }

  console.log(
    `OK — seeded ${RESTAURANTS.length} restaurants + ${OFFERS.length} live offers.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
