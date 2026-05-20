// Brand button. Pill-shaped — the signature shape from the consumer
// prototype, unified across all three sections (D2 design pass).
//
// A plain <button> so it composes with server-action <form action={…}>
// forms throughout the app.

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full " +
    "font-semibold whitespace-nowrap cursor-pointer " +
    "transition-[transform,background-color,color,border-color] " +
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Orange fill — primary calls to action.
        primary: "bg-orange text-white hover:bg-orange-deep",
        // Ink fill — high-emphasis alternative / dark surfaces.
        dark: "bg-ink text-cream hover:bg-ink-soft",
        // Quiet — transparent with a warm border.
        ghost: "border border-border bg-transparent text-ink hover:bg-cream-warm",
        // Orange outline — secondary actions that still want brand color.
        outline:
          "border border-orange bg-transparent text-orange hover:bg-orange-tint",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-6 text-sm",
        lg: "h-14 px-8 text-[15px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
