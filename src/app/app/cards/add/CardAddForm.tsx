"use client";

// Stripe Elements card-add form. Renders inside an <Elements> provider
// scoped to the SetupIntent we created on the server.
//
// Flow:
//   1. User fills card -> stripe.confirmSetup() with redirect: if_required
//   2. On immediate success, we have setupIntent.payment_method -> hand
//      to the server (syncSavedCard) so the cards table mirrors it
//   3. Router push to /app/cards

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { syncSavedCard } from "../actions";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export function CardAddForm({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <Form />
    </Elements>
  );
}

function Form() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      // Skip the 3DS/redirect step when not strictly needed. For plain
      // card adds in test mode this lets us stay on this page.
      redirect: "if_required",
      confirmParams: {
        // Required by Stripe even with redirect: if_required, in case 3DS
        // does kick in. We land back here; the SetupIntent param is what
        // Stripe puts on the URL.
        return_url:
          typeof window !== "undefined"
            ? `${window.location.origin}/app/cards/add`
            : "/app/cards/add",
      },
    });

    if (confirmError) {
      setError(confirmError.message ?? "Could not save card.");
      setSubmitting(false);
      return;
    }

    if (!setupIntent || typeof setupIntent.payment_method !== "string") {
      setError("Stripe didn't return a payment method. Try again.");
      setSubmitting(false);
      return;
    }

    const paymentMethodId = setupIntent.payment_method;

    startTransition(async () => {
      try {
        await syncSavedCard(paymentMethodId);
        router.push("/app/cards");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setSubmitting(false);
      }
    });
  }

  const busy = submitting || pending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!stripe || !elements || busy}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}
