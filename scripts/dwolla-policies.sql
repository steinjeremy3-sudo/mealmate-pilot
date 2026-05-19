-- Phase 4d.2: RLS for diner_dwolla_accounts.
--
-- Read access:
--   - owner (the diner themselves): user_id = auth.uid().
--   - admin: ops staff.
--
-- Write access:
--   - All inserts/updates happen from server actions or webhook
--     handlers via the service-role client. No INSERT/UPDATE/DELETE
--     policies for users — defense in depth.
--
-- Idempotent. Applied via `npm run setup:dwolla-policies`.

DROP POLICY IF EXISTS diner_dwolla_accounts_select_owner_or_admin ON public.diner_dwolla_accounts;
CREATE POLICY diner_dwolla_accounts_select_owner_or_admin ON public.diner_dwolla_accounts
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );
