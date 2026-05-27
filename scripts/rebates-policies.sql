-- Phase 4d.1: RLS for the rebates table.
--
-- Read access:
--   - owner: the diner whose card the rebate goes to (via
--     plaid_card_accounts → plaid_items.user_id).
--   - admin: ops staff via the admin section.
--
-- Write access:
--   - Inserts and updates all happen from server actions / cron via
--     the service-role client. No INSERT/UPDATE/DELETE policies for
--     users — defense-in-depth against a leaked anon key.
--
-- Idempotent. Applied via `npm run setup:rebates-policies`.

ALTER TABLE public.rebates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rebates_select_owner_or_admin ON public.rebates;
CREATE POLICY rebates_select_owner_or_admin ON public.rebates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.plaid_card_accounts pca
      JOIN public.plaid_items pi ON pi.id = pca.plaid_item_id
      WHERE pca.id = rebates.plaid_card_account_id
        AND pi.user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );
