// Brand eyebrow — the small mono uppercase label that sits above
// headings throughout the kit (JetBrains Mono, wide tracking).

import { cn } from "@/lib/utils";

export type EyebrowProps = React.ComponentProps<"p"> & {
  /** 'paprika' (default, brand accent) or 'muted' (quiet, secondary). */
  tone?: "paprika" | "muted";
};

export function Eyebrow({ className, tone = "paprika", ...props }: EyebrowProps) {
  return (
    <p
      className={cn(
        "font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
        tone === "paprika" ? "text-paprika" : "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
