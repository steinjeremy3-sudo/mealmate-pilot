// Visa card mockup — the rotated card visual from the design bundle's
// Plaid-linking screen. Presentational; the caller sizes / rotates it.

import { cn } from "@/lib/utils";

export function CardMockup({
  mask,
  label,
  className,
}: {
  /** Last 4 digits, if a card is linked. */
  mask?: string | null;
  /** Small caption on the card (card name, or "Your Visa" when empty). */
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-[1.6/1] w-full flex-col justify-between rounded-2xl",
        "bg-gradient-to-br from-ink-soft to-ink p-5 text-cream-soft shadow-xl",
        className,
      )}
    >
      {/* Chip */}
      <div className="h-6 w-9 rounded bg-gradient-to-br from-[#d4af6f] to-[#8c7244]" />
      <div className="space-y-3">
        <p className="font-mono text-sm tracking-[0.18em]">
          ···· ···· ···· {mask ?? "••••"}
        </p>
        <div className="flex items-end justify-between gap-3">
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-cream/55">
            {label ?? "Linked card"}
          </span>
          <span className="font-sans text-xl font-bold tracking-tight">
            VISA
          </span>
        </div>
      </div>
    </div>
  );
}
