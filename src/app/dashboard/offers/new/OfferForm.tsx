"use client";

// Merchant offer form — five fields. Controlled inputs drive a live diner
// preview on the right. Used for both creating (action=createOffer) and
// editing (action=updateOffer + offerId + initial values).

import { useState } from "react";

import { Button, Card, Eyebrow, PlaceholderImg } from "@/components/brand";
import { formatDayRange } from "@/lib/offers/format";
import { cn } from "@/lib/utils";

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
  "w-full rounded-lg border border-border bg-bone px-3 py-2.5 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";
const labelClass =
  "mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground";

export type OfferFormValues = {
  discount: number;
  days: string[];
  start: string; // "HH:MM"
  end: string;
  minCheck: number;
  /** null = no cap (unlimited redemptions). */
  maxRedemptions: number | null;
  recurring: boolean;
};

export function OfferForm({
  restaurantName,
  cuisine,
  neighborhood,
  photoUrl,
  error,
  action,
  offerId,
  initial,
  submitLabel = "Publish offer",
  submitHint = "Goes live as soon as you publish.",
}: {
  restaurantName: string;
  cuisine: string;
  neighborhood: string;
  photoUrl?: string | null;
  error?: string;
  /** Server action the form submits to (createOffer or updateOffer). */
  action: (formData: FormData) => void | Promise<void>;
  /** Present when editing — emitted as a hidden offer_id input. */
  offerId?: string;
  /** Prefill values when editing; create uses sensible defaults. */
  initial?: OfferFormValues;
  submitLabel?: string;
  submitHint?: string;
}) {
  const [discount, setDiscount] = useState(initial?.discount ?? 25);
  const [days, setDays] = useState<Set<string>>(
    new Set(initial?.days ?? ["tue", "wed"]),
  );
  const [start, setStart] = useState(initial?.start ?? "17:00");
  const [end, setEnd] = useState(initial?.end ?? "22:00");
  const [minCheck, setMinCheck] = useState(initial?.minCheck ?? 40);
  const [unlimited, setUnlimited] = useState(
    initial ? initial.maxRedemptions == null : false,
  );
  const [maxRedemptions, setMaxRedemptions] = useState(
    initial?.maxRedemptions ?? 100,
  );
  const [recurring, setRecurring] = useState(initial?.recurring ?? true);

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
      <form action={action}>
        {offerId ? (
          <input type="hidden" name="offer_id" value={offerId} />
        ) : null}
        <Card className="space-y-5 p-6">
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
              className="w-full accent-paprika"
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
                        ? "border-ink bg-ink text-bone"
                        : "border-border bg-bone text-muted-foreground hover:bg-bone-deep",
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
                min={10}
                value={minCheck}
                onChange={(e) => setMinCheck(Number(e.target.value))}
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                $10 minimum (the platform fee floor)
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="max_redemptions">
                Max redemptions
              </label>
              {unlimited ? (
                <>
                  <input type="hidden" name="max_redemptions" value="unlimited" />
                  <div
                    className={cn(
                      inputClass,
                      "flex items-center text-muted-foreground",
                    )}
                  >
                    Unlimited
                  </div>
                </>
              ) : (
                <input
                  id="max_redemptions"
                  name="max_redemptions"
                  type="number"
                  min={1}
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(Number(e.target.value))}
                  required
                  className={inputClass}
                />
              )}
              <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                  className="accent-paprika"
                />
                No limit
              </label>
            </div>
          </div>

          {/* Recurring */}
          <label className="flex items-start gap-3 rounded-lg border border-border bg-bone p-3.5 has-checked:border-paprika has-checked:bg-paprika-tint">
            <input
              type="checkbox"
              name="recurring"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="mt-0.5 accent-paprika"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">
                Recurring weekly
              </span>
              <span className="block text-xs text-muted-foreground">
                Runs every selected day at this window, indefinitely.
                Uncheck for a single one-off run.
              </span>
            </span>
          </label>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="border-t border-border pt-5">
            <Button type="submit" className="w-full">
              {submitLabel}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {submitHint}
            </p>
          </div>
        </Card>
      </form>

      {/* ===== Live preview ===== */}
      <div className="h-fit space-y-3 lg:sticky lg:top-8">
        <Eyebrow tone="muted">Diner preview</Eyebrow>
        <div className="rounded-2xl bg-ink p-5 text-bone">
          <div className="relative">
            <PlaceholderImg
              name={restaurantName}
              src={photoUrl}
              className="h-32 rounded-xl"
            />
            <span className="absolute right-2.5 top-2.5 rounded-full bg-paprika px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.05em] text-white">
              {discount}% OFF
            </span>
          </div>
          <div className="mt-3.5 space-y-1.5">
            <Eyebrow>
              {dayRange ? `${dayRange} · ${start}–${end}` : "Pick days"}
            </Eyebrow>
            <p className="font-display text-2xl leading-tight">
              {restaurantName}
            </p>
            <p className="text-sm text-bone/60">
              {cuisine} · {neighborhood}
            </p>
            <p className="mt-3 border-t border-white/10 pt-3 text-xs text-bone/60">
              Minimum check ${minCheck} ·{" "}
              {unlimited ? "Unlimited redemptions" : `${maxRedemptions} redemptions`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
