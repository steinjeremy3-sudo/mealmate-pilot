-- RLS for diner_astra_accounts (push-to-debit cash back).
--
-- Read access:
--   - owner (the diner themselves): user_id = auth.uid().
--   - admin: ops staff.
--
-- Write access:
--   - All inserts/updates happen from server actions or webhook
--     handlers via the service-role client. No INSERT/UPDATE/DELETE
--     policies for users — defense in depth. The encrypted OAuth
--     tokens in this table must never be reachable from a client.
--
-- Idempotent. Applied via `npm run setup:astra-policies`.

ALTER TABLE public.diner_astra_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diner_astra_accounts_select_owner_or_admin ON public.diner_astra_accounts;
CREATE POLICY diner_astra_accounts_select_owner_or_admin ON public.diner_astra_accounts
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );
