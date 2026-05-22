"use client";

// Merchant offer creation form. Controlled inputs drive a live diner
// preview on the right. Submits to the createOffer server action —
// field names mirror what the action reads.

import { useState } from "react";

import { Button, Card, Eyebrow, PlaceholderImg } from "@/components/brand";
import { formatDayRange } from "@/lib/offers/format";
import { cn } from "@/lib/utils";

import { createOffer } from "./actions";

const DAYS: [string, string][] = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

const inputClass =
  "w-full rounded-lg border border-border bg-cream-soft px-3 py-2.5 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange";
const labelClass =
  "mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground";

/** "YYYY-MM-DDTHH:MM" for a datetime-local default, in local time. */
function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function OfferForm({
  restaurantName,
  cuisine,
  neighborhood,
  error,
}: {
  restaurantName: string;
  cuisine: string;
  neighborhood: string;
  error?: string;
}) {
  const [discount, setDiscount] = useState(25);
  const [days, setDays] = useState<Set<string>>(new Set(["tue", "wed"]));
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("22:00");
  const [minCheck, setMinCheck] = useState(40);
  const [budget, setBudget] = useState(2000);

  const toggleDay = (d: string) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const dayRange = formatDayRange([...days]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      {/* ===== Form ===== */}
      <form action={createOffer}>
        <Card className="space-y-5 p-6">
          <div>
            <label className={labelClass} htmlFor="title">
              Offer name
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="Tuesday–Wednesday dinner"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={2}
              placeholder="25% off your dinner check, Tuesday and Wednesday."
              className={cn(inputClass, "resize-y")}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="discount_pct">
              Discount · {discount}% off
            </label>
            <input
              id="discount_pct"
              name="discount_pct"
              type="range"
              min={15}
              max={50}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full accent-orange"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>15%</span>
              <span>50%</span>
            </div>
          </div>

          <div>
            <span className={labelClass}>Days of week</span>
            <div className="flex gap-1.5">
              {DAYS.map(([value, label]) => {
                const on = days.has(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={cn(
                      "flex-1 rounded-lg border py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                      on
                        ? "border-ink bg-ink text-cream"
                        : "border-border bg-cream-soft text-muted-foreground hover:bg-cream-warm",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* Submitted values — the action reads day_<code> === "on". */}
            {[...days].map((d) => (
              <input key={d} type="hidden" name={`day_${d}`} value="on" />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="valid_start_time">
                Window start
              </label>
              <input
                id="valid_start_time"
                name="valid_start_time"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="valid_end_time">
                Window end
              </label>
              <input
                id="valid_end_time"
                name="valid_end_time"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="min_check">
                Min check ($)
              </label>
              <input
                id="min_check"
                name="min_check"
                type="number"
                min={0}
                value={minCheck}
                onChange={(e) => setMinCheck(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="monthly_budget">
                Monthly budget ($)
              </label>
              <input
                id="monthly_budget"
                name="monthly_budget"
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="starts_at">
                Offer starts
              </label>
              <input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                defaultValue={localNow()}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ends_at">
                Offer ends (optional)
              </label>
              <input
                id="ends_at"
                name="ends_at"
                type="datetime-local"
                className={inputClass}
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="border-t border-border pt-5">
            <Button type="submit" className="w-full">
              Save as draft
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              New offers save as drafts. Publish from the offer page.
            </p>
          </div>
        </Card>
      </form>

      {/* ===== Live preview ===== */}
      <div className="h-fit space-y-3 lg:sticky lg:top-8">
        <Eyebrow tone="muted">Diner preview</Eyebrow>
        <div className="rounded-2xl bg-ink-deep p-5 text-cream-soft">
          <div className="relative">
            <PlaceholderImg
              name={restaurantName}
              className="h-32 rounded-xl"
            />
            <span className="absolute right-2.5 top-2.5 rounded-full bg-orange px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.05em] text-white">
              {discount}% OFF
            </span>
          </div>
          <div className="mt-3.5 space-y-1.5">
            <Eyebrow>
              {dayRange ? `${dayRange} · ${start}–${end}` : "Pick days"}
            </Eyebrow>
            <p className="font-serif text-2xl leading-tight">
              {restaurantName}
            </p>
            <p className="text-sm text-cream/60">
              {cuisine} · {neighborhood}
            </p>
            <p className="mt-3 border-t border-white/10 pt-3 text-xs text-cream/60">
              Minimum check ${minCheck}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
