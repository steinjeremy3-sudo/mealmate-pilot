"use server";

// Diner rebate-destination setup. Flow:
//
//   1. Ensure the diner has a Dwolla 'receive-only' customer
//      (created on first call; persisted in diner_dwolla_accounts).
//   2. Mint a Plaid processor token for the selected card account.
//      Plaid validates that the underlying account is depository
//      (checking/savings); credit-card rows fail here.
//   3. POST the processor token to Dwolla as a new funding source.
//   4. Persist the funding source URL as the diner's default rebate
//      destination.
//
// No card data, no PCI scope. All the financial verification is
// handled inside Plaid (account ownership) + Dwolla (funding source
// readiness for transfers).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProcessorTokenCreateRequestProcessorEnum } from "plaid";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import {
  getDinerDwollaAccount,
  setDefaultCardFundingSource,
  upsertDinerDwollaCustomer,
} from "@/lib/db/diner-dwolla";
import { getPlaidItemForUse } from "@/lib/db/plaid-items";
import {
  attachPlaidFundingSource,
  createReceiveOnlyCustomer,
  splitDisplayName,
} from "@/lib/dwolla";
import { plaid } from "@/lib/plaid";
import { sendInitiatedRebates } from "@/lib/rebates/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function setRebateDestination(formData: FormData): Promise<void> {
  const profile = await requireRole("diner");
  const cardId = String(formData.get("plaid_card_account_id") ?? "");
  if (!cardId) redirect("/app/rebates/setup");

  // 1. Ensure Dwolla customer exists. Idempotent: if a row already
  //    has the URL, we reuse it.
  let dwollaAccount = await getDinerDwollaAccount(profile.id);
  if (!dwollaAccount) {
    if (!profile.email) {
      throw new Error(
        "setRebateDestination: diner has no email on file (required by Dwolla)",
      );
    }
    const { firstName, lastName } = splitDisplayName(profile.displayName);
    const customerUrl = await createReceiveOnlyCustomer({
      email: profile.email,
      firstName,
      lastName,
    });
    await upsertDinerDwollaCustomer(profile.id, customerUrl);
    dwollaAccount = await getDinerDwollaAccount(profile.id);
    if (!dwollaAccount) {
      throw new Error("setRebateDestination: customer upsert lost");
    }

    await logAuditEvent({
      actor: { id: profile.id, role: profile.role },
      action: "dwolla.customer_created",
      subjectType: "diner_dwolla_account",
      subjectId: profile.id,
      metadata: { dwolla_customer_url: customerUrl },
    });
  }

  // 2. Load the chosen card + parent item (service role since
  //    plaid_items has no SELECT policy by design).
  const admin = createSupabaseAdminClient();
  const { data: card, error: cardErr } = await admin
    .from("plaid_card_accounts")
    .select(
      "id, plaid_item_id, plaid_account_id, mask, plaid_items!inner ( user_id )",
    )
    .eq("id", cardId)
    .maybeSingle();
  if (cardErr || !card) {
    throw new Error(`setRebateDestination: card ${cardId} not loadable`);
  }
  const cardItem = Array.isArray(card.plaid_items)
    ? card.plaid_items[0]
    : card.plaid_items;
  if (cardItem?.user_id !== profile.id) {
    throw new Error("setRebateDestination: card does not belong to diner");
  }

  const plaidItem = await getPlaidItemForUse(card.plaid_item_id);
  if (!plaidItem) {
    throw new Error(`setRebateDestination: plaid_item ${card.plaid_item_id} not loadable`);
  }

  // 3. Mint Plaid processor token for Dwolla. This call fails if
  //    the underlying account isn't depository (e.g. credit card),
  //    which is the natural validation we want.
  const tokenResp = await plaid.processorTokenCreate({
    access_token: plaidItem.accessToken,
    account_id: card.plaid_account_id,
    processor: ProcessorTokenCreateRequestProcessorEnum.Dwolla,
  });

  // 4. Attach to Dwolla customer.
  const fundingSourceUrl = await attachPlaidFundingSource({
    customerUrl: dwollaAccount.dwollaCustomerUrl,
    plaidProcessorToken: tokenResp.data.processor_token,
    name: card.mask ? `Checking ···· ${card.mask}` : "Checking",
  });

  // 5. Persist as default.
  await setDefaultCardFundingSource(profile.id, fundingSourceUrl);

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "dwolla.funding_source_attached",
    subjectType: "diner_dwolla_account",
    subjectId: profile.id,
    metadata: {
      plaid_card_account_id: cardId,
      funding_source_url: fundingSourceUrl,
    },
  });

  // Clear any rebate backlog that was waiting on this diner having
  // a destination. Failures here don't fail the setup action —
  // they're logged and the next cron tick retries.
  try {
    await sendInitiatedRebates({ dinerUserId: profile.id });
  } catch (err) {
    console.error("setRebateDestination: backlog send failed:", err);
  }

  revalidatePath("/app/rebates/setup");
  redirect("/app/rebates/setup");
}
