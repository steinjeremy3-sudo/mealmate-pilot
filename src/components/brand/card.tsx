// Brand card — a warm surface panel with a soft border. Matches the
// rounded card containers used across the prototypes.

import { cn } from "@/lib/utils";

export type CardProps = React.ComponentProps<"div"> & {
  /** Drop the default padding (for cards that manage their own layout). */
  flush?: boolean;
};

export function Card({ className, flush, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground",
        !flush && "p-5",
        className,
      )}
      {...props}
    />
  );
}
