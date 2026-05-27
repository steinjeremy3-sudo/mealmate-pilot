-- Phase 4b: RLS policies for plaid_items + plaid_card_accounts.
--
-- plaid_items.access_token is a server-only secret. To keep it from
-- ever leaving the server context we deliberately do NOT grant admin
-- SELECT on plaid_items. If ops needs to inspect an item, they use the
-- service role directly (which bypasses RLS). plaid_card_accounts has
-- no secret material — owner + admin can both read.
--
-- Writes (INSERT/UPDATE/DELETE) for plaid_items happen exclusively
-- from server actions via the service role. plaid_card_accounts
-- allows owner UPDATE for default-flag / remove flows.
--
-- Idempotent. Applied via `npm run setup:plaid-policies`.

ALTER TABLE public.plaid_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_card_accounts ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- plaid_items
-- ====================================================================

DROP POLICY IF EXISTS plaid_items_select_owner ON public.plaid_items;
CREATE POLICY plaid_items_select_owner ON public.plaid_items
  FOR SELECT
  USING (user_id = auth.uid());


-- ====================================================================
-- plaid_card_accounts
-- ====================================================================
-- SELECT: owner (via parent plaid_items) OR admin.

DROP POLICY IF EXISTS plaid_card_accounts_select_owner_or_admin ON public.plaid_card_accounts;
CREATE POLICY plaid_card_accounts_select_owner_or_admin ON public.plaid_card_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plaid_items pi
      WHERE pi.id = plaid_card_accounts.plaid_item_id
        AND pi.user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );

-- UPDATE: owner only (used for default-flag toggle + soft remove).
DROP POLICY IF EXISTS plaid_card_accounts_update_owner ON public.plaid_card_accounts;
CREATE POLICY plaid_card_accounts_update_owner ON public.plaid_card_accounts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.plaid_items pi
      WHERE pi.id = plaid_card_accounts.plaid_item_id
        AND pi.user_id = auth.uid()
    )
  );

-- No INSERT/DELETE for users — server actions use the service role to
-- insert during Plaid Link exchange. Card removal is soft (status='removed').
