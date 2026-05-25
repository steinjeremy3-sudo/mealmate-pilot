// Diner: a restaurant's full menu, reached from the offer screen.

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { Card, Eyebrow, Heading } from "@/components/brand";
import { getMenuForRestaurant, groupBySection } from "@/lib/db/menu";
import { getOfferById } from "@/lib/db/offers";
import { centsToUsd } from "@/lib/money";

type Params = Promise<{ id: string }>;

export default async function OfferMenuPage({
  params,
}: {
  params: Params;
}) {
  await requireRole("diner");
  const { id } = await params;
  const offer = await getOfferById(id);
  if (!offer) notFound();

  const menu = await getMenuForRestaurant(offer.restaurant_id);
  const sections = groupBySection(menu);
  const hasDiscountItems = menu.some((m) => m.discountEligible);
  const name = offer.restaurant?.name ?? "Restaurant";

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Link
          href={`/app/offers/${id}`}
          className="text-sm text-muted-foreground transition-colors hover:text-paprika"
        >
          ← {name}
        </Link>

        <div className="space-y-1.5">
          <Eyebrow>{name}</Eyebrow>
          <Heading as="h1" size="display">
            The <em>menu.</em>
          </Heading>
        </div>

        {hasDiscountItems ? (
          <Card className="flex items-center gap-2 bg-paprika-tint text-sm text-paprika-deep">
            <span className="size-2 shrink-0 rounded-full bg-paprika" />
            Highlighted items qualify for {offer.discount_pct}% off.
          </Card>
        ) : null}

        {sections.length === 0 ? (
          <Card className="border-dashed text-center text-sm text-muted-foreground">
            {name} hasn&apos;t published a menu yet.
          </Card>
        ) : (
          <div className="space-y-6">
            {sections.map((s) => (
              <section key={s.section} className="space-y-1">
                <h2 className="border-b border-border pb-2 font-display text-xl tracking-tight">
                  {s.section}
                </h2>
                <ul>
                  {s.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 text-sm last:border-b-0"
                    >
                      <span className="flex items-center gap-2">
                        {it.discountEligible ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-paprika" />
                        ) : null}
                        {it.name}
                      </span>
                      <span className="shrink-0 font-mono text-muted-foreground">
                        {centsToUsd(it.priceCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
