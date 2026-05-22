// Server-only helpers for diner_astra_accounts — a diner's push-to-
// debit cash-back destination (Astra). One row per diner, created on
// the card-connect return. OAuth tokens are encrypted at rest.

import "server-only";

import { decryptToken, encryptToken } from "@/lib/crypto/token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Account state WITHOUT the tokens — safe for general reads. */
export type DinerAstraAccount = {
  userId: string;
  astraUserId: string | null;
  cardId: string | null;
  cardLast4: string | null;
};

export type DinerAstraTokens = {
  accessToken: string;
  refreshToken: string;
  /** Unix epoch milliseconds. */
  expiresAt: number;
};

/** A diner's Astra account (no tokens). Null if they haven't connected. */
export async function getDinerAstraAccount(
  userId: string,
): Promise<DinerAstraAccount | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("diner_astra_accounts")
    .select("user_id, astra_user_id, card_id, card_last4")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getDinerAstraAccount:", error);
    return null;
  }
  if (!data) return null;
  return {
    userId: data.user_id,
    astraUserId: data.astra_user_id,
    cardId: data.card_id,
    cardLast4: data.card_last4,
  };
}

/** Internal: the diner's DECRYPTED Astra tokens, for API calls. */
export async function getDinerAstraTokens(
  userId: string,
): Promise<DinerAstraTokens | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("diner_astra_accounts")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("getDinerAstraTokens:", error);
    return null;
  }
  return {
    accessToken: decryptToken(data.access_token),
    refreshToken: decryptToken(data.refresh_token),
    expiresAt: new Date(data.token_expires_at).getTime(),
  };
}

/** Encrypt + store a diner's Astra OAuth tokens (created at code exchange). */
export async function upsertDinerAstraTokens(
  userId: string,
  args: { astraUserId?: string | null; tokens: DinerAstraTokens },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("diner_astra_accounts").upsert(
    {
      user_id: userId,
      astra_user_id: args.astraUserId ?? null,
      access_token: encryptToken(args.tokens.accessToken),
      refresh_token: encryptToken(args.tokens.refreshToken),
      token_expires_at: new Date(args.tokens.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`upsertDinerAstraTokens: ${error.message}`);
}

/** Record the diner's connected debit card (the cash-back destination). */
export async function setDinerAstraCard(
  userId: string,
  args: { cardId: string; cardLast4: string | null },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("diner_astra_accounts")
    .update({
      card_id: args.cardId,
      card_last4: args.cardLast4,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(`setDinerAstraCard: ${error.message}`);
}
