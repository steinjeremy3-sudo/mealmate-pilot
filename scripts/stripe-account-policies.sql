-- Phase 4a: RLS policies for restaurant_stripe_accounts.
--
-- SELECT: restaurant owner can see their own; admin sees all.
-- INSERT/UPDATE/DELETE: server-only via service role (Stripe onboarding
--   server action creates rows; webhook handler updates them). No
--   user-facing INSERT/UPDATE/DELETE policy on purpose.
--
-- Idempotent. Applied via `npm run setup:stripe-account-policies`.

DROP POLICY IF EXISTS restaurant_stripe_accounts_select_owner_or_admin
  ON public.restaurant_stripe_accounts;
CREATE POLICY restaurant_stripe_accounts_select_owner_or_admin
  ON public.restaurant_stripe_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_stripe_accounts.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );
