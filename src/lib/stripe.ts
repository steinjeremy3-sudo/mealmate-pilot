// Server-side Stripe client. Singleton.
//
// IMPORTANT: never import from a Client Component — STRIPE_SECRET_KEY
// is a server-only credential.

import "server-only";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Add it to .env.local (see .env.example).",
  );
}

// API version is pinned to the SDK's default for predictable behavior. We
// don't override — letting the SDK pick keeps types and runtime in sync.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
