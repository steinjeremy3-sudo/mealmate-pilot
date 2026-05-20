"use client";

// Diner search — live client-side filtering over the live offers, by
// restaurant name, cuisine, neighborhood, or offer title.

import { useState } from "react";

import { Card } from "@/components/brand";

import { OfferCard, type OfferCardData } from "../OfferCard";

export function OfferSearch({ offers }: { offers: OfferCardData[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const shown = term
    ? offers.filter((o) => {
        const r = o.restaurant;
        return (
          (r?.name ?? "").toLowerCase().includes(term) ||
          (r?.cuisine ?? "").toLowerCase().includes(term) ||
          (r?.neighborhood ?? "").toLowerCase().includes(term) ||
          o.title.toLowerCase().includes(term)
        );
      })
    : offers;

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Restaurant, cuisine, neighborhood…"
        autoFocus
        className="w-full rounded-full border border-border bg-cream-soft px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
      />

      {shown.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-muted-foreground">
          {term
            ? "Nothing matches — try a cuisine or neighborhood."
            : "No live offers right now."}
        </Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((o) => (
            <li key={o.id}>
              <OfferCard offer={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
