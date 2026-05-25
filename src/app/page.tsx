// Marketing landing (public). A dark, editorial hero echoing the
// consumer prototype's welcome screen.

import Link from "next/link";

import { buttonVariants, Eyebrow, Heading } from "@/components/brand";

export default function Home() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-ink px-6 py-20">
      {/* Warm paprika glow, top-right — the welcome-screen signature. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem]"
        style={{
          background:
            "radial-gradient(circle, rgba(232,117,74,0.40) 0%, rgba(232,117,74,0) 70%)",
        }}
      />

      <div className="relative w-full max-w-xl space-y-6 text-center">
        <Eyebrow className="flex justify-center">Mealmate · Dallas</Eyebrow>

        <Heading as="h1" size="display" className="text-bone">
          Eat well. Get a <em>little back</em>.
        </Heading>

        <p className="text-base text-bone/70">
          Activate an offer at an independent Dallas restaurant, pay
          however you normally would, and cash back lands on your linked
          card a day or two later. No coupons, no apps at the table.
        </p>

        <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up?as=diner"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            Start as a diner
          </Link>
          <Link
            href="/sign-up?as=merchant"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            List your restaurant
          </Link>
        </div>

        <p className="pt-1 text-sm text-bone/50">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-bone underline underline-offset-4 hover:text-paprika"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
