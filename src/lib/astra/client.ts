// Astra API client — the push-to-debit cash-back rail.
//
// Astra authorizes per-DINER: the diner completes Astra's hosted
// card-connect, returns to our redirect URL with an OAuth `code`, and
// we exchange that code (with our client_id/client_secret) for the
// diner's access + refresh tokens. Subsequent calls for that diner
// are Bearer-authed with their access token.
//
// Verified against the sandbox 2026-05-21: base host, /v1/oauth/token
// shape, and that grant_type is authorization_code / refresh_token
// (not client_credentials).

import "server-only";

const BASE_URL =
  process.env.ASTRA_API_BASE_URL ?? "https://api-sandbox.astra.finance";

/** A non-2xx response from the Astra API. */
export class AstraError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly body: string,
  ) {
    super(`Astra API ${httpStatus}: ${body.slice(0, 300)}`);
    this.name = "AstraError";
  }
}

function clientCredentials(): { id: string; secret: string } {
  const id = process.env.ASTRA_CLIENT_ID;
  const secret = process.env.ASTRA_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "ASTRA_CLIENT_ID / ASTRA_CLIENT_SECRET are not set in the environment",
    );
  }
  return { id, secret };
}

export type AstraTokens = {
  accessToken: string;
  refreshToken: string;
  /** Unix epoch milliseconds at which the access token expires. */
  expiresAt: number;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
};

/** POST /v1/oauth/token — client_id/secret go in username/password fields. */
async function postToken(
  params: Record<string, string>,
): Promise<AstraTokens> {
  const { id, secret } = clientCredentials();
  const res = await fetch(`${BASE_URL}/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      username: id,
      password: secret,
      ...params,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new AstraError(res.status, text);
  const json = JSON.parse(text) as TokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

/**
 * Exchange the OAuth `code` from the card-connect return for the
 * diner's tokens. `redirectUri` must exactly match the one registered
 * with Astra and used to start the flow.
 */
export function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<AstraTokens> {
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

/** Trade a refresh token for a fresh access token. */
export function refreshAccessToken(
  refreshToken: string,
): Promise<AstraTokens> {
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/**
 * Bearer-authed request against the Astra API for a specific diner.
 * Returns the parsed JSON body; throws AstraError on a non-2xx.
 */
export async function astraFetch<T = unknown>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new AstraError(res.status, text);
  return (text ? JSON.parse(text) : null) as T;
}

// --- Card-connect (diner-facing OAuth) -----------------------------

/**
 * The hosted page a diner is sent to in order to connect their debit
 * card and authorize MealMate. Astra redirects back to redirectUri
 * with an OAuth `code`.
 *
 * NOTE: Astra's hosted-flow host + params couldn't be fully extracted
 * from their (client-rendered) docs — verify on the first sandbox
 * run. ASTRA_CONNECT_URL overrides the base without a code change.
 */
export function cardConnectUrl(redirectUri: string, state: string): string {
  const base =
    process.env.ASTRA_CONNECT_URL ??
    "https://app.astra.finance/cards/connect";
  const params = new URLSearchParams({
    client_id: clientCredentials().id,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `${base}?${params.toString()}`;
}

export type AstraCard = {
  id: string;
  last4: string | null;
  type: string | null;
  status: string | null;
};

/** List the diner's connected cards (GET /v1/cards). */
export async function listCards(accessToken: string): Promise<AstraCard[]> {
  const data = await astraFetch<unknown>(accessToken, "/v1/cards");
  const arr: unknown[] = Array.isArray(data)
    ? data
    : ((data as { cards?: unknown[] })?.cards ?? []);
  return arr
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        id: String(o.id ?? ""),
        last4: (o.last_four ?? o.last4 ?? null) as string | null,
        type: (o.card_type ?? o.type ?? null) as string | null,
        status: (o.status ?? null) as string | null,
      };
    })
    .filter((c) => c.id);
}
