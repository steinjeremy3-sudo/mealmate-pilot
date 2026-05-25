// Brand chip — a pill toggle/filter per the v2.0 kit. Inactive is a
// quiet outline on bone; active fills with ink.

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
          "focus-visible:ring-paprika focus-visible:ring-offset-2 " +
          "focus-visible:ring-offset-background",
        active
          ? "border-ink bg-ink text-bone"
          : "border-border bg-transparent text-ink hover:bg-bone-deep",
        className,
      )}
      {...props}
    />
  );
}
