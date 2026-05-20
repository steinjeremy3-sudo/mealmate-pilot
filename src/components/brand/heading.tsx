// Brand heading — Fraunces serif display type. Nested <em> renders as
// italic orange emphasis automatically, matching the prototypes
// (e.g. <Heading><em>25%</em> off dinner</Heading>).
//
// Italic Fraunces has tall descenders (g, y, p, f). Each size carries
// padding-bottom so descenders never crash into the content below —
// a recurring bug across deck/prototype iterations (B2 spec).

import { cn } from "@/lib/utils";

export type HeadingProps = React.ComponentProps<"h2"> & {
  /** Visual scale. Defaults to 'page'. */
  size?: "display" | "page" | "section";
  /** Rendered element. Defaults to <h2>. */
  as?: "h1" | "h2" | "h3";
};

// Each size pairs its type scale with descender-safe padding-bottom.
const sizeClasses: Record<NonNullable<HeadingProps["size"]>, string> = {
  display: "text-[2.5rem] leading-[1.1] pb-8",
  page: "text-2xl leading-tight pb-6",
  section: "text-lg leading-snug pb-3",
};

export function Heading({
  className,
  size = "page",
  as: Tag = "h2",
  ...props
}: HeadingProps) {
  return (
    <Tag
      className={cn(
        "font-serif font-medium tracking-tight text-foreground",
        "[&_em]:italic [&_em]:font-medium [&_em]:text-orange",
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
