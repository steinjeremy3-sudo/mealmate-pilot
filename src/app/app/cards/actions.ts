"use server";

// Plaid Link server actions for diner card linking.
//
// Flow (client + server):
//   1. /app/cards renders → server action `createLinkToken` returns a
//      Plaid link_token bound to this diner.
//   2. Client component (<PlaidLinkButton>) calls Plaid Link with that
//      token. User picks a bank + accounts, finishes the flow.
//   3. Plaid Link calls `onSuccess` with a `public_token`. The client
//      forwards it to `exchangePublicToken` (this file).
//   4. Server: trade public_token → access_token via Plaid API, fetch
//      the linked accounts, write plaid_items + plaid_card_accounts
//      via the service role.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CountryCode,
  CreditAccountSubtype,
  DepositoryAccountSubtype,
  Products,
} from "plaid";

import { requireRole } from "@/lib/auth/require-role";
import { encryptPlaidAccessToken } from "@/lib/crypto/plaid-token";
import { logAuditEvent } from "@/lib/db/audit-log";
import { plaid } from "@/lib/plaid";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Generate a fresh link_token for the calling diner. Plaid link_tokens
 * are short-lived (4h) and per-user.
 */
export async function createLinkToken(): Promise<{ linkToken: string }> {
  const profile = await requireRole("diner");

  const response = await plaid.linkTokenCreate({
    user: { client_user_id: profile.id },
    client_name: "MealMate",
    // Transactions: read history so the matcher can attribute charges.
    // Auth: mint Dwolla processor tokens for ACH rebate destinations
    // (Phase 4d.2). Asking for both at link time means the diner
    // grants access once, not twice.
    products: [Products.Transactions, Products.Auth],
    country_codes: [CountryCode.Us],
    language: "en",
    // Accept credit cards OR checking accounts. Checking is where a
    // debit card draws from — both card types flow through Visa/MC at
    // POS and both can receive Visa Direct rebates, so the rebate
    // model works either way. Phase 4c's matching engine doesn't care
    // about credit vs debit; it cares about the transaction stream.
    account_filters: {
      credit: {
        account_subtypes: [CreditAccountSubtype.CreditCard],
      },
      depository: {
        account_subtypes: [DepositoryAccountSubtype.Checking],
      },
    },
  });

  return { linkToken: response.data.link_token };
}

/**
 * Exchange a public_token (from Plaid Link onSuccess) for a long-lived
 * access_token, fetch the linked accounts, write to DB. Returns the
 * number of card accounts persisted so the client can refresh.
 */
export async function exchangePublicToken(
  publicToken: string,
): Promise<{ cardCount: number }> {
  const profile = await requireRole("diner");
  if (!publicToken) throw new Error("Missing public_token");

  // 1. Exchange public_token for an access_token + item_id.
  const exchange = await plaid.itemPublicTokenExchange({
    public_token: publicToken,
  });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  // 2. Pull institution name for nicer UI later.
  let institutionName: string | null = null;
  try {
    const itemResp = await plaid.itemGet({ access_token: accessToken });
    const institutionId = itemResp.data.item.institution_id;
    if (institutionId) {
      const inst = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = inst.data.institution.name;
    }
  } catch (err) {
    // Non-fatal — institution name is cosmetic.
    console.warn("plaid institution lookup failed:", err);
  }

  // 3. List the accounts on the Item. Filter to the same set we
  //    advertised in the link_token (credit cards + checking) — Plaid
  //    Link's account_filters are advisory, so re-filter here.
  const accountsResp = await plaid.accountsGet({ access_token: accessToken });
  const cardAccounts = accountsResp.data.accounts.filter(
    (a) => a.subtype === "credit card" || a.subtype === "checking",
  );

  const admin = createSupabaseAdminClient();

  // 4. Insert the Plaid Item via service role. The access_token is the
  //    long-lived bearer credential — encrypt it before persisting so a
  //    DB compromise (leaked backup, leaked service-role key) doesn't
  //    immediately yield bank-transaction access. Decryption happens
  //    only in server contexts that have PLAID_TOKEN_ENCRYPTION_KEY.
  const encryptedAccessToken = encryptPlaidAccessToken(accessToken);
  const { data: item, error: itemErr } = await admin
    .from("plaid_items")
    .insert({
      user_id: profile.id,
      plaid_item_id: itemId,
      access_token: encryptedAccessToken,
      institution_name: institutionName,
      status: "active",
    })
    .select("id")
    .single();

  if (itemErr || !item) {
    throw new Error(`plaid_items insert: ${itemErr?.message ?? "no row"}`);
  }

  // 5. Insert card accounts. If this is the diner's first card, mark
  //    the first one default. The user-scoped client respects RLS so
  //    the count is naturally scoped to the diner via plaid_items.user_id.
  const userClient = await createSupabaseServerClient();
  const { count: existingCardCount } = await userClient
    .from("plaid_card_accounts")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  const hasNoCardsYet = (existingCardCount ?? 0) === 0;

  let savedCount = 0;
  for (const acc of cardAccounts) {
    const { error: accErr } = await admin.from("plaid_card_accounts").insert({
      plaid_item_id: item.id,
      plaid_account_id: acc.account_id,
      name: acc.name ?? null,
      official_name: acc.official_name ?? null,
      mask: acc.mask ?? null,
      // Plaid doesn't expose card brand cleanly without the Auth
      // product; we leave brand null and infer at display time from
      // official_name when needed. Phase 4c can populate this from
      // transaction metadata.
      brand: null,
      // 'credit card' or 'checking' — used by /app/rebates/setup to
      // filter rebate-eligible accounts (Phase 4d.2).
      subtype: acc.subtype ?? null,
      is_default: hasNoCardsYet && savedCount === 0,
      status: "active",
    });
    if (accErr) {
      console.error(`plaid_card_accounts insert (${acc.account_id}):`, accErr);
      continue;
    }
    savedCount += 1;
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "plaid_item.linked",
    subjectType: "plaid_item",
    subjectId: item.id,
    metadata: {
      institution_name: institutionName,
      card_count: savedCount,
    },
  });

  revalidatePath("/app/cards");
  return { cardCount: savedCount };
}

/** Flip which card is the diner's default. */
export async function setDefaultCard(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");
  const cardId = String(formData.get("card_id") ?? "");
  if (!cardId) redirect("/app/cards");

  const supabase = await createSupabaseServerClient();
  // RLS scopes both queries to the diner's own cards (via the parent
  // plaid_item.user_id check).
  await supabase
    .from("plaid_card_accounts")
    .update({ is_default: false })
    .neq("id", cardId);
  await supabase
    .from("plaid_card_accounts")
    .update({ is_default: true })
    .eq("id", cardId);

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "plaid_card.set_default",
    subjectType: "plaid_card_account",
    subjectId: cardId,
  });

  revalidatePath("/app/cards");
  redirect("/app/cards");
}

/** Soft-remove a card (status='removed'). The Plaid Item stays linked. */
export async function removeCard(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");
  const cardId = String(formData.get("card_id") ?? "");
  if (!cardId) redirect("/app/cards");

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("plaid_card_accounts")
    .update({ status: "removed", is_default: false })
    .eq("id", cardId);

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "plaid_card.removed",
    subjectType: "plaid_card_account",
    subjectId: cardId,
  });

  revalidatePath("/app/cards");
  redirect("/app/cards");
}
