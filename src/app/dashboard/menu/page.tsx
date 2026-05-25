// Merchant menu management — add and remove the dishes diners see on
// the restaurant's offer screen.

import { redirect } from "next/navigation";

import { Button, Card, Eyebrow } from "@/components/brand";
import { PageHeader } from "@/components/console/PageHeader";
import { requireRole } from "@/lib/auth/require-role";
import { getMenuForRestaurant, groupBySection } from "@/lib/db/menu";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { centsToUsd } from "@/lib/money";

import { createMenuItem, removeMenuItem } from "./actions";

const inputClass =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";
const labelClass =
  "mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground";

export default async function MerchantMenuPage() {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const menu = await getMenuForRestaurant(restaurant.id);
  const sections = groupBySection(menu);

  return (
    <>
      <PageHeader
        eyebrow={restaurant.name}
        title={
          <>
            Your menu
          </>
        }
        sub="The dishes diners see on your offer. Flag the ones your discount applies to."
      />

      <div className="px-10 py-8">
        <div className="grid w-full max-w-3xl gap-6 md:grid-cols-[1fr_1.4fr]">
          {/* Add an item */}
          <Card className="h-fit p-6">
            <h2 className="font-display text-xl tracking-tight">Add an item</h2>
            <form action={createMenuItem} className="mt-4 space-y-4">
              <div>
                <label className={labelClass} htmlFor="section">
                  Section
                </label>
                <input
                  id="section"
                  name="section"
                  required
                  placeholder="Pasta"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="name">
                  Item
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  placeholder="Cacio e pepe"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="price">
                  Price ($)
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="discount_eligible"
                  className="accent-paprika"
                />
                The discount applies to this item
              </label>
              <Button type="submit" className="w-full">
                Add to menu
              </Button>
            </form>
          </Card>

          {/* Current menu */}
          <div className="space-y-5">
            {sections.length === 0 ? (
              <Card className="border-dashed text-center text-sm text-muted-foreground">
                No menu items yet. Add your first one on the left.
              </Card>
            ) : (
              sections.map((s) => (
                <div key={s.section} className="space-y-1.5">
                  <Eyebrow tone="muted">{s.section}</Eyebrow>
                  <Card flush>
                    {s.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {it.name}
                          </p>
                          {it.discountEligible ? (
                            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-paprika-deep">
                              Discount applies
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 font-mono text-sm">
                          {centsToUsd(it.priceCents)}
                        </span>
                        <form action={removeMenuItem}>
                          <input
                            type="hidden"
                            name="item_id"
                            value={it.id}
                          />
                          <button
                            type="submit"
                            className="cursor-pointer text-xs text-destructive underline underline-offset-4"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    ))}
                  </Card>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
