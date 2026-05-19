// Server-side Plaid client. Singleton.
//
// IMPORTANT: never import from a Client Component — PLAID_SECRET is
// server-only and Plaid access tokens / link tokens come from server.

import "server-only";

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  throw new Error(
    "PLAID_CLIENT_ID or PLAID_SECRET is not set. Add to .env.local (see .env.example).",
  );
}

const env = process.env.PLAID_ENV ?? "sandbox";
const basePath = PlaidEnvironments[env as keyof typeof PlaidEnvironments];
if (!basePath) {
  throw new Error(
    `PLAID_ENV must be one of: sandbox, development, production. Got: ${env}`,
  );
}

const configuration = new Configuration({
  basePath,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaid = new PlaidApi(configuration);
