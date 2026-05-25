// Brand heading — Archivo Black display type per the v2.0 kit. A
// nested <em> renders as solid paprika emphasis (suppress the browser
// default italic) so callers can highlight a single word inline:
//   <Heading><em>25%</em> off dinner</Heading>

import { cn } from "@/lib/utils";

export type HeadingProps = React.ComponentProps<"h2"> & {
  /** Visual scale. Defaults to 'page'. */
  size?: "display" | "page" | "section";
  /** Rendered element. Defaults to <h2>. */
  as?: "h1" | "h2" | "h3";
};

const sizeClasses: Record<NonNullable<HeadingProps["size"]>, string> = {
  display: "text-[2.75rem] leading-[1.05] pb-2",
  page: "text-[1.75rem] leading-[1.1] pb-1.5",
  section: "text-[1.5rem] leading-[1.15] pb-1",
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
        "font-display tracking-[-0.02em] text-foreground",
        "[&_em]:not-italic [&_em]:text-paprika",
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
