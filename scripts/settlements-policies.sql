-- Phase 4e: RLS for settlements + restaurant_billing_customers.
--
-- settlements SELECT: the restaurant owner (a merchant viewing what
-- they owe) OR admin. restaurant_billing_customers SELECT: same.
--
-- All writes happen from the weekly cron + Stripe webhook via the
-- service-role client, which bypasses RLS — so no INSERT/UPDATE/DELETE
-- policies for users.
--
-- Idempotent. Applied via `npm run setup:settlements-policies`.

-- ====================================================================
-- settlements
-- ====================================================================

DROP POLICY IF EXISTS settlements_select_owner_or_admin ON public.settlements;
CREATE POLICY settlements_select_owner_or_admin ON public.settlements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = settlements.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );

-- ====================================================================
-- restaurant_billing_customers
-- ====================================================================

DROP POLICY IF EXISTS restaurant_billing_customers_select_owner_or_admin ON public.restaurant_billing_customers;
CREATE POLICY restaurant_billing_customers_select_owner_or_admin ON public.restaurant_billing_customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_billing_customers.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );
