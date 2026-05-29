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
            The menu
          </Heading>
        </div>

        <Card className="bg-paprika-tint text-sm text-paprika-deep">
          {offer.discount_pct}% off your whole check when you activate
          this offer
        </Card>

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
                  {s.items.map((it) => {
                    const discountedCents = Math.round(
                      it.priceCents * (1 - offer.discount_pct / 100),
                    );
                    return (
                      <li
                        key={it.id}
                        className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 text-sm last:border-b-0"
                      >
                        <span className="min-w-0">
                          {it.name}
                          {it.description ? (
                            <span className="block text-xs text-muted-foreground">
                              {it.description}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2 font-mono">
                          <s className="text-muted-foreground">
                            {centsToUsd(it.priceCents)}
                          </s>
                          <span className="text-paprika">
                            {centsToUsd(discountedCents)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
