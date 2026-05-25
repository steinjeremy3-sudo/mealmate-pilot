// Brand button. v2.0 kit shape — `rounded-lg` (~8px), not pill — and
// the kit's three colour treatments mapped onto the existing variant
// names so callers don't churn:
//   primary → paprika fill (the kit's accent fill)
//   dark    → ink fill (the kit's primary)
//   outline → paprika outline
//   ghost   → quiet bone-on-transparent
//
// A plain <button> so it composes with server-action <form action={…}>
// forms throughout the app.

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg " +
    "font-semibold whitespace-nowrap cursor-pointer " +
    "transition-[transform,background-color,color,border-color] " +
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Paprika fill — appetite-forward CTAs.
        primary: "bg-paprika text-bone hover:bg-paprika-deep",
        // Ink fill — the kit's default canvas-typesetting button.
        dark: "bg-ink text-bone hover:bg-ink-soft",
        // Paprika outline — secondary, still brand-tinted.
        outline:
          "border-[1.5px] border-paprika bg-transparent text-paprika hover:bg-paprika-tint",
        // Quiet — transparent with a soft border.
        ghost: "border border-border bg-transparent text-ink hover:bg-bone-deep",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-7 text-[15px]",
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
