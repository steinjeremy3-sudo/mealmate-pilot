-- RLS for matched_transactions.
--
-- Read access:
--   - owner: the diner whose card produced the transaction (via the
--     plaid_card_account → plaid_item.user_id chain).
--   - merchant: the owner of the restaurant a transaction was matched
--     to — so they can see the matched transactions behind their
--     weekly settlement (B5).
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

ALTER TABLE public.matched_transactions ENABLE ROW LEVEL SECURITY;

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

-- A merchant may read matched_transactions resolved to a restaurant
-- they own. Postgres OR-combines multiple SELECT policies, so this
-- widens read access without touching the owner/admin policy above.
DROP POLICY IF EXISTS matched_transactions_select_merchant ON public.matched_transactions;
CREATE POLICY matched_transactions_select_merchant ON public.matched_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = matched_transactions.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
  );

-- No INSERT, UPDATE, or DELETE policies — all writes go through the
-- service role.
