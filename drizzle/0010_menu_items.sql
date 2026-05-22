-- Restaurant menus.
--
-- menu_items — sections of named, priced items per restaurant.
-- Merchants manage these; diners view them on the offer screen.
-- discount_eligible flags items the offer's discount applies to.
--
-- Hand-written (drizzle-kit generate requires a TTY).

CREATE TABLE "menu_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "section" text NOT NULL,
  "name" text NOT NULL,
  "price_cents" integer NOT NULL,
  "discount_eligible" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk"
  FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
