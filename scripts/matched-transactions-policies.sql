-- Phase 4c.7: RLS for matched_transactions.
--
-- Read access:
--   - owner: the diner whose card produced the transaction (via the
--     plaid_card_account → plaid_item.user_id chain).
--   - admin: ops staff via the admin section.
-- Other roles get nothing.
--
-- Write access:
--   - Inserts and updates all happen from server actions / the cron
--     route via the service-role client. Service role bypasses RLS,
--     so we deliberately add NO INSERT or UPDATE policies for users.
--   - Defense-in-depth: explicit DELETE policy = none.
--
-- Idempotent. Applied via `npm run setup:matched-transactions-policies`.

DROP POLICY IF EXISTS matched_transactions_select_owner_or_admin ON public.matched_transactions;
CREATE POLICY matched_transactions_select_owner_or_admin ON public.matched_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.plaid_card_accounts pca
      JOIN public.plaid_items pi ON pi.id = pca.plaid_item_id
      WHERE pca.id = matched_transactions.plaid_card_account_id
        AND pi.user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );

-- No INSERT, UPDATE, or DELETE policies — all writes go through the
-- service role.
