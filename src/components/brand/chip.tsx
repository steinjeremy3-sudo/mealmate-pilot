// Brand chip — a pill toggle/filter. Inactive is a quiet outline;
// active fills with ink, matching the prototypes' filter chips.

import { cn } from "@/lib/utils";

export type ChipProps = React.ComponentProps<"button"> & {
  active?: boolean;
};

export function Chip({
  className,
  active = false,
  type = "button",
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      data-active={active || undefined}
      className={cn(
        "inline-flex items-center rounded-full border px-4 py-2 " +
          "text-[13px] font-medium whitespace-nowrap cursor-pointer " +
          "transition-colors active:scale-[0.97] " +
          "focus-visible:outline-none focus-visible:ring-2 " +
          "focus-visible:ring-orange focus-visible:ring-offset-2 " +
          "focus-visible:ring-offset-background",
        active
          ? "border-ink bg-ink text-cream"
          : "border-border bg-transparent text-ink hover:bg-cream-warm",
        className,
      )}
      {...props}
    />
  );
}
