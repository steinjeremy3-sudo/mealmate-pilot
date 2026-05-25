// Server-side Dwolla client. Singleton, lazy auth.
//
// Phase 4d.2: card-collection + push-to-card flow. Dwolla's v2 client
// handles OAuth2 client_credentials auth internally and renews the
// bearer as needed; we just need to pass key / secret / environment.
//
// IMPORTANT: never import from a Client Component. Dwolla secret is
// server-only. The Dwolla.js card-add iframe (which IS client-side)
// authenticates via a short-lived client_token minted server-side.

import "server-only";

import { Client } from "dwolla-v2";

if (!process.env.DWOLLA_KEY || !process.env.DWOLLA_SECRET) {
  throw new Error(
    "DWOLLA_KEY or DWOLLA_SECRET is not set. Add to .env.local (see .env.example).",
  );
}

const env = process.env.DWOLLA_ENVIRONMENT ?? "sandbox";
if (env !== "sandbox" && env !== "production") {
  throw new Error(
    `DWOLLA_ENVIRONMENT must be 'sandbox' or 'production'. Got: ${env}`,
  );
}

export const dwolla = new Client({
  key: process.env.DWOLLA_KEY,
  secret: process.env.DWOLLA_SECRET,
  environment: env as "sandbox" | "production",
});

// ====================================================================
// Mealmate's own balance funding source (source of money for transfers)
// ====================================================================
//
// Every Dwolla account has a default 'balance' funding source. In
// sandbox it's pre-funded with infinite test money. In production it
// holds whatever we've pulled in via ACH or wire. We need its URL
// to use as the source href on every transfer.
//
// One-time lookup, cached in module memory so we don't re-fetch on
// every transfer.

let cachedSourceFundingUrl: string | null = null;

export async function getMealMateBalanceFundingUrl(): Promise<string> {
  if (cachedSourceFundingUrl) return cachedSourceFundingUrl;

  // /  → returns auth.account link
  const rootResp = await dwolla.get("/");
  const accountUrl = rootResp.body?._links?.account?.href as string | undefined;
  if (!accountUrl) {
    throw new Error("Dwolla: could not find auth account URL on /");
  }

  // /accounts/{id}/funding-sources → list, find type='balance'
  const fundingResp = await dwolla.get(`${accountUrl}/funding-sources`);
  const sources = (fundingResp.body?._embedded?.["funding-sources"] ?? []) as Array<{
    type: string;
    _links: { self: { href: string } };
  }>;
  const balance = sources.find((s) => s.type === "balance");
  if (!balance) {
    throw new Error("Dwolla: no balance funding source on master account");
  }
  cachedSourceFundingUrl = balance._links.self.href;
  return cachedSourceFundingUrl;
}

/**
 * Extract the resource URL from a Dwolla create response. Dwolla
 * returns 201 Created with a Location header containing the new
 * resource's URL — the v2 SDK exposes this as `response.headers.get`.
 */
export function locationOf(response: unknown): string {
  const r = response as { headers?: { get?: (k: string) => string | null } };
  const loc = r.headers?.get?.("location");
  if (!loc) throw new Error("Dwolla response missing Location header");
  return loc;
}

// ====================================================================
// Customer + funding-source helpers
// ====================================================================

export type DinerProfileForDwolla = {
  email: string;
  /** Best-effort split of users.display_name. */
  firstName: string;
  lastName: string;
};

/**
 * Split a free-form display_name into first/last for Dwolla. Dwolla
 * requires both fields even for receive-only customers. If the name
 * has no space we duplicate it — not ideal but pragmatic for pilot.
 */
export function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = displayName.trim();
  if (!trimmed) return { firstName: "Mealmate", lastName: "Diner" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Create a Dwolla 'receive-only' Customer. Receive-only customers can
 * accept transfers but can't send — exactly what we need for rebate
 * recipients. No SSN, no address, no DOB required.
 *
 * Returns the new customer URL (Location header from Dwolla). Caller
 * persists this on diner_dwolla_accounts.
 */
export async function createReceiveOnlyCustomer(
  profile: DinerProfileForDwolla,
): Promise<string> {
  const resp = await dwolla.post("customers", {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    type: "receive-only",
  });
  return locationOf(resp);
}

/**
 * Attach a Plaid-linked bank account to a Dwolla customer using a
 * Plaid processor token. No card details, no PCI — Plaid has already
 * verified the account via the diner's bank login.
 *
 * Returns the new funding source URL.
 */
export async function attachPlaidFundingSource(args: {
  customerUrl: string;
  plaidProcessorToken: string;
  name: string;
}): Promise<string> {
  const resp = await dwolla.post(`${args.customerUrl}/funding-sources`, {
    plaidToken: args.plaidProcessorToken,
    name: args.name,
  });
  return locationOf(resp);
}
