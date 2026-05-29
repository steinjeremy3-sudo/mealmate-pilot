// One-off: seed a Mexican menu for the real production restaurant
// "Jeremy's Cafe" (id 431fed69-7d78-42ab-ae94-eac369c450ac, cuisine
// "Mexican", Knox-Henderson). The canon seed-menus.ts only covers the
// eight hardcoded seed restaurants, so this real merchant needed its
// own menu.
//
// Looks the restaurant up by id, CLEARS any existing menu_items (the
// merchant had a single stray "Cacio e Pepe" test item left over from
// poking at the dashboard — Jeremy asked to replace it), then inserts
// a coherent Mexican menu. Reasonable Dallas neighbourhood prices.
//
// Usage: `npm run seed:jeremys-cafe-menu`

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.");
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESTAURANT_ID = "431fed69-7d78-42ab-ae94-eac369c450ac";

type Item = {
  section: string;
  name: string;
  description: string;
  priceCents: number;
};

// Sections render in the order rows are created (menu.ts orders by
// section then created_at). Antojitos → Tacos → Platos fuertes →
// Postres → Bebidas reads top-to-bottom like a real Mexican menu.
const ITEMS: Item[] = [
  { section: "Antojitos", name: "Guacamole hecho a mano", description: "Mashed tableside with lime, cilantro, and serrano; warm totopos", priceCents: 1200 },
  { section: "Antojitos", name: "Elote en vaso", description: "Grilled corn off the cob, crema, cotija, and chile-lime", priceCents: 800 },
  { section: "Antojitos", name: "Queso fundido con chorizo", description: "Melted Oaxaca cheese and house chorizo with flour tortillas", priceCents: 1400 },
  { section: "Antojitos", name: "Sopes de tinga", description: "Thick corn cakes topped with chicken tinga, beans, and crema", priceCents: 1300 },

  { section: "Tacos", name: "Tacos al pastor", description: "Trompo-roasted pork, pineapple, onion, and cilantro (3)", priceCents: 1400 },
  { section: "Tacos", name: "Tacos de carnitas", description: "Slow-braised pork, salsa verde, and pickled onion (3)", priceCents: 1400 },
  { section: "Tacos", name: "Tacos de pescado", description: "Beer-battered fish, cabbage slaw, and chipotle crema (3)", priceCents: 1600 },
  { section: "Tacos", name: "Tacos de hongos (veg)", description: "Roasted mushrooms, epazote, and salsa roja (3)", priceCents: 1300 },

  { section: "Platos fuertes", name: "Enchiladas en mole poblano", description: "Three chicken enchiladas under house mole, sesame, and crema", priceCents: 1900 },
  { section: "Platos fuertes", name: "Chiles rellenos", description: "Poblanos stuffed with cheese, egg-battered, in tomato broth", priceCents: 2000 },
  { section: "Platos fuertes", name: "Carne asada con nopales", description: "Grilled skirt steak, charred cactus, rice, and frijoles", priceCents: 2600 },
  { section: "Platos fuertes", name: "Camarones a la diabla", description: "Shrimp in spicy guajillo-chile sauce with rice", priceCents: 2400 },

  { section: "Postres", name: "Flan de cajeta", description: "Goat's-milk caramel custard", priceCents: 900 },
  { section: "Postres", name: "Churros con chocolate", description: "Cinnamon-sugar churros with warm chocolate for dipping", priceCents: 800 },

  { section: "Bebidas", name: "Horchata", description: "House-made rice-cinnamon agua fresca", priceCents: 500 },
  { section: "Bebidas", name: "Agua de jamaica", description: "Tart hibiscus agua fresca", priceCents: 500 },
];

async function main() {
  // Confirm the restaurant exists.
  const { data: restaurant, error: restErr } = await supabase
    .from("restaurants")
    .select("id, name, cuisine")
    .eq("id", RESTAURANT_ID)
    .maybeSingle();

  if (restErr) {
    console.error(`ERROR looking up restaurant: ${restErr.message}`);
    process.exit(1);
  }
  if (!restaurant) {
    console.error(`Restaurant ${RESTAURANT_ID} not in DB — aborting.`);
    process.exit(1);
  }
  console.log(`Seeding menu for "${restaurant.name}" (${restaurant.cuisine}).`);

  // Clear existing items (replace, per Jeremy).
  const { error: delErr } = await supabase
    .from("menu_items")
    .delete()
    .eq("restaurant_id", RESTAURANT_ID);
  if (delErr) {
    console.error(`ERROR clearing existing items: ${delErr.message}`);
    process.exit(1);
  }

  const rows = ITEMS.map((it) => ({
    restaurant_id: RESTAURANT_ID,
    section: it.section,
    name: it.name,
    description: it.description,
    price_cents: it.priceCents,
  }));

  const { error: insErr } = await supabase.from("menu_items").insert(rows);
  if (insErr) {
    console.error(`ERROR inserting menu: ${insErr.message}`);
    process.exit(1);
  }

  console.log(`OK — inserted ${rows.length} items.`);
  process.exit(0);
}

void main();
