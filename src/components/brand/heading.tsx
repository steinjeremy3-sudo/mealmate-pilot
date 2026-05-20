// Brand heading — Fraunces serif display type. Nested <em> renders as
// italic orange emphasis automatically, matching the prototypes
// (e.g. <Heading><em>25%</em> off dinner</Heading>).

import { cn } from "@/lib/utils";

export type HeadingProps = React.ComponentProps<"h2"> & {
  /** Visual scale. Defaults to 'page'. */
  size?: "display" | "page" | "section";
  /** Rendered element. Defaults to <h2>. */
  as?: "h1" | "h2" | "h3";
};

const sizeClasses: Record<NonNullable<HeadingProps["size"]>, string> = {
  display: "text-[2.5rem] leading-[1.05]",
  page: "text-2xl leading-tight",
  section: "text-lg leading-snug",
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
