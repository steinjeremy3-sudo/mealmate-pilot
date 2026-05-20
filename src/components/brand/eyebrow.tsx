// Brand eyebrow — the small mono uppercase label that sits above
// headings throughout the prototypes (JetBrains Mono, wide tracking).

import { cn } from "@/lib/utils";

export type EyebrowProps = React.ComponentProps<"p"> & {
  /** 'orange' (default, brand accent) or 'muted' (quiet, secondary). */
  tone?: "orange" | "muted";
};

export function Eyebrow({ className, tone = "orange", ...props }: EyebrowProps) {
  return (
    <p
      className={cn(
        "font-mono text-[10px] font-medium uppercase tracking-[0.15em]",
        tone === "orange" ? "text-orange" : "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
