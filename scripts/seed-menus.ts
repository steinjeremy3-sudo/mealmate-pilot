// Seed cuisine-appropriate menus for the 8 canon restaurants in
// seed.ts. Each restaurant gets ~10–14 items across 3–4 sections.
//
// Idempotent: for each restaurant we check whether any menu items
// already exist. If yes, we skip — preserving anything a merchant
// curated. If no, we insert the cuisine-appropriate seed set.
//
// Restaurants whose IDs aren't in the database are silently skipped,
// so this is safe to run against any environment.
//
// Usage: `npm run seed:menus`

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

type Item = { section: string; name: string; priceCents: number };

type Menu = {
  restaurantId: string;
  restaurantName: string; // just for logging
  items: Item[];
};

// Each restaurant ID matches scripts/seed.ts. Prices are reasonable
// for a Dallas neighbourhood spot — starters/sides $8–$16, mains
// $14–$32, desserts $7–$10.
const MENUS: Menu[] = [
  {
    restaurantId: "00000000-0000-0000-0000-000000000001",
    restaurantName: "Lucia",
    items: [
      { section: "Starters", name: "Bruschetta al pomodoro", priceCents: 1200 },
      { section: "Starters", name: "Burrata e prosciutto", priceCents: 1800 },
      { section: "Starters", name: "Caesar", priceCents: 1400 },
      { section: "Pasta", name: "Cacio e pepe", priceCents: 2400 },
      { section: "Pasta", name: "Carbonara", priceCents: 2600 },
      { section: "Pasta", name: "Pappardelle al ragù", priceCents: 2800 },
      { section: "Mains", name: "Branzino al sale", priceCents: 3800 },
      { section: "Mains", name: "Bistecca alla fiorentina", priceCents: 5200 },
      { section: "Mains", name: "Pollo alla parmigiana", priceCents: 2800 },
      { section: "Dolci", name: "Tiramisù", priceCents: 1000 },
      { section: "Dolci", name: "Affogato", priceCents: 900 },
    ],
  },
  {
    restaurantId: "00000000-0000-0000-0000-000000000002",
    restaurantName: "Veracruz Cocina",
    items: [
      { section: "Antojitos", name: "Elote", priceCents: 800 },
      { section: "Antojitos", name: "Guacamole con totopos", priceCents: 1200 },
      { section: "Antojitos", name: "Sopes de tinga", priceCents: 1400 },
      { section: "Tacos", name: "Al pastor", priceCents: 600 },
      { section: "Tacos", name: "Pescado Veracruzano", priceCents: 700 },
      { section: "Tacos", name: "Carnitas", priceCents: 650 },
      { section: "Platos fuertes", name: "Mole negro", priceCents: 2400 },
      { section: "Platos fuertes", name: "Chiles rellenos", priceCents: 2200 },
      { section: "Platos fuertes", name: "Camarones a la diabla", priceCents: 2600 },
      { section: "Postres", name: "Flan de cajeta", priceCents: 900 },
      { section: "Postres", name: "Churros", priceCents: 800 },
    ],
  },
  {
    restaurantId: "00000000-0000-0000-0000-000000000003",
    restaurantName: "Smoke & Tinder",
    items: [
      { section: "Plates", name: "Brisket plate", priceCents: 2400 },
      { section: "Plates", name: "St. Louis ribs", priceCents: 2600 },
      { section: "Plates", name: "Pulled pork plate", priceCents: 2000 },
      { section: "Plates", name: "Hot links + brisket combo", priceCents: 2800 },
      { section: "Sandwiches", name: "Chopped brisket sandwich", priceCents: 1600 },
      { section: "Sandwiches", name: "Pulled pork sandwich", priceCents: 1400 },
      { section: "Sides", name: "Mac & cheese", priceCents: 700 },
      { section: "Sides", name: "Coleslaw", priceCents: 500 },
      { section: "Sides", name: "Pit beans", priceCents: 600 },
      { section: "Sides", name: "Cornbread", priceCents: 500 },
      { section: "Desserts", name: "Banana pudding", priceCents: 800 },
      { section: "Desserts", name: "Pecan pie", priceCents: 900 },
    ],
  },
  {
    restaurantId: "00000000-0000-0000-0000-000000000004",
    restaurantName: "Trompo East",
    items: [
      { section: "Tacos", name: "Al pastor", priceCents: 450 },
      { section: "Tacos", name: "Suadero", priceCents: 500 },
      { section: "Tacos", name: "Lengua", priceCents: 550 },
      { section: "Tacos", name: "Bistec", priceCents: 500 },
      { section: "Tacos", name: "Tripa", priceCents: 500 },
      { section: "Sides", name: "Consomé", priceCents: 600 },
      { section: "Sides", name: "Cebollitas asadas", priceCents: 500 },
      { section: "Sides", name: "Frijoles charros", priceCents: 700 },
      { section: "Bebidas", name: "Horchata", priceCents: 500 },
      { section: "Bebidas", name: "Jamaica", priceCents: 500 },
      { section: "Postres", name: "Tres leches", priceCents: 800 },
    ],
  },
  {
    restaurantId: "00000000-0000-0000-0000-000000000005",
    restaurantName: "Wendigo Cellar",
    items: [
      { section: "Boards", name: "Cheese board", priceCents: 2400 },
      { section: "Boards", name: "Charcuterie", priceCents: 2600 },
      { section: "Boards", name: "Mixed board", priceCents: 3200 },
      { section: "Small plates", name: "Castelvetrano olives", priceCents: 800 },
      { section: "Small plates", name: "Marinated artichokes", priceCents: 1200 },
      { section: "Small plates", name: "Mussels meunière", priceCents: 1800 },
      { section: "Mains", name: "Steak frites", priceCents: 3400 },
      { section: "Mains", name: "Roast chicken for two", priceCents: 4200 },
      { section: "Mains", name: "Mushroom risotto", priceCents: 2400 },
      { section: "Desserts", name: "Pot de crème", priceCents: 1000 },
      { section: "Desserts", name: "Dark chocolate tart", priceCents: 1100 },
    ],
  },
  {
    restaurantId: "00000000-0000-0000-0000-000000000006",
    restaurantName: "The Lemon Tree",
    items: [
      { section: "Mezze", name: "Hummus", priceCents: 1000 },
      { section: "Mezze", name: "Baba ghanouj", priceCents: 1100 },
      { section: "Mezze", name: "Tabbouleh", priceCents: 1000 },
      { section: "Mezze", name: "Stuffed grape leaves", priceCents: 1200 },
      { section: "Mains", name: "Lamb shawarma plate", priceCents: 2200 },
      { section: "Mains", name: "Chicken souvlaki", priceCents: 1800 },
      { section: "Mains", name: "Falafel platter", priceCents: 1600 },
      { section: "Mains", name: "Whole grilled branzino", priceCents: 2800 },
      { section: "Sides", name: "Pita & dips", priceCents: 800 },
      { section: "Sides", name: "Greek salad", priceCents: 1200 },
      { section: "Desserts", name: "Baklava", priceCents: 700 },
      { section: "Desserts", name: "Knafeh", priceCents: 900 },
    ],
  },
  {
    restaurantId: "00000000-0000-0000-0000-000000000007",
    restaurantName: "Anchovy & Roe",
    items: [
      { section: "Raw bar", name: "Oysters (½ dozen)", priceCents: 2200 },
      { section: "Raw bar", name: "Tuna crudo", priceCents: 1800 },
      { section: "Raw bar", name: "Hamachi", priceCents: 2000 },
      { section: "Plates", name: "Whole branzino", priceCents: 3600 },
      { section: "Plates", name: "Pan-seared halibut", priceCents: 3800 },
      { section: "Plates", name: "Cioppino", priceCents: 3400 },
      { section: "Pasta", name: "Lobster pasta", priceCents: 4200 },
      { section: "Pasta", name: "Clams linguine", priceCents: 2800 },
      { section: "Desserts", name: "Key lime pie", priceCents: 900 },
      { section: "Desserts", name: "Olive oil cake", priceCents: 1000 },
    ],
  },
  {
    restaurantId: "00000000-0000-0000-0000-000000000008",
    restaurantName: "Tropico",
    items: [
      { section: "Starters", name: "Ceviche mixto", priceCents: 1600 },
      { section: "Starters", name: "Empanadas (3)", priceCents: 1200 },
      { section: "Starters", name: "Yuca fries", priceCents: 800 },
      { section: "Mains", name: "Lechón asado", priceCents: 2400 },
      { section: "Mains", name: "Pollo a la brasa", priceCents: 2000 },
      { section: "Mains", name: "Ropa vieja", priceCents: 2200 },
      { section: "Sides", name: "Plátanos maduros", priceCents: 600 },
      { section: "Sides", name: "Arroz con frijoles", priceCents: 700 },
      { section: "Postres", name: "Tres leches", priceCents: 800 },
      { section: "Postres", name: "Dulce de leche flan", priceCents: 800 },
    ],
  },
];

async function main() {
  let seededCount = 0;
  let skippedCount = 0;
  let missingCount = 0;

  for (const menu of MENUS) {
    // Restaurant exists?
    const { data: restaurant, error: restErr } = await supabase
      .from("restaurants")
      .select("id")
      .eq("id", menu.restaurantId)
      .maybeSingle();

    if (restErr) {
      console.error(`  ERROR checking ${menu.restaurantName}: ${restErr.message}`);
      process.exit(1);
    }

    if (!restaurant) {
      console.log(`  ~ ${menu.restaurantName} — restaurant not in DB, skipping`);
      missingCount++;
      continue;
    }

    // Already has menu items? Don't clobber merchant-curated state.
    const { count, error: countErr } = await supabase
      .from("menu_items")
      .select("id", { head: true, count: "exact" })
      .eq("restaurant_id", menu.restaurantId);

    if (countErr) {
      console.error(`  ERROR counting ${menu.restaurantName}: ${countErr.message}`);
      process.exit(1);
    }

    if ((count ?? 0) > 0) {
      console.log(
        `  ~ ${menu.restaurantName} — already has ${count} items, skipping`,
      );
      skippedCount++;
      continue;
    }

    const rows = menu.items.map((it) => ({
      restaurant_id: menu.restaurantId,
      section: it.section,
      name: it.name,
      price_cents: it.priceCents,
    }));

    const { error: insErr } = await supabase.from("menu_items").insert(rows);
    if (insErr) {
      console.error(`  ERROR seeding ${menu.restaurantName}: ${insErr.message}`);
      process.exit(1);
    }

    console.log(`  ✓ ${menu.restaurantName} — ${rows.length} items`);
    seededCount++;
  }

  console.log(
    `OK — seeded ${seededCount}, skipped ${skippedCount}, missing ${missingCount}.`,
  );
  process.exit(0);
}

void main();
