-- Phase 2b: RLS policies for offers + one extra policy on restaurants
-- so diners can read approved restaurants when listing offers.
--
-- Idempotent — every CREATE has a matching DROP IF EXISTS before it.
-- Re-running is safe.
--
-- Applied via `npm run setup:offer-policies`.


-- ====================================================================
-- restaurants — public read of APPROVED restaurants
-- ====================================================================
-- The existing restaurants_select_owner_or_admin policy only lets owners
-- and admins read restaurants. Diners need to see approved restaurants
-- when browsing offers (the offer rows reference restaurant_id and we
-- join to show name / neighborhood / etc.).
--
-- RLS policies are OR'd together, so adding this doesn't weaken anything —
-- it only opens an additional path for approved rows.

DROP POLICY IF EXISTS restaurants_select_public_approved ON public.restaurants;
CREATE POLICY restaurants_select_public_approved ON public.restaurants
  FOR SELECT
  USING (status = 'approved');


-- ====================================================================
-- offers
-- ====================================================================
-- SELECT layers (OR'd):
--   - Public read of live offers from approved restaurants → diner browse
--   - Owner read of their own restaurant's offers (any status) → merchant
--   - Admin read of everything

DROP POLICY IF EXISTS offers_select_public_live ON public.offers;
CREATE POLICY offers_select_public_live ON public.offers
  FOR SELECT
  USING (
    status = 'live'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = offers.restaurant_id AND r.status = 'approved'
    )
  );

DROP POLICY IF EXISTS offers_select_owner_or_admin ON public.offers;
CREATE POLICY offers_select_owner_or_admin ON public.offers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = offers.restaurant_id AND r.owner_user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );

-- INSERT: merchants can only insert offers for restaurants they own.
DROP POLICY IF EXISTS offers_insert_merchant_owns_restaurant ON public.offers;
CREATE POLICY offers_insert_merchant_owns_restaurant ON public.offers
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'merchant'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = offers.restaurant_id AND r.owner_user_id = auth.uid()
    )
  );

-- UPDATE: merchant for own; admin for all.
DROP POLICY IF EXISTS offers_update_owner_or_admin ON public.offers;
CREATE POLICY offers_update_owner_or_admin ON public.offers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = offers.restaurant_id AND r.owner_user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );

-- DELETE: same gate as update. Soft-delete via status='ended' is preferred
-- but we won't enforce that at the policy level.
DROP POLICY IF EXISTS offers_delete_owner_or_admin ON public.offers;
CREATE POLICY offers_delete_owner_or_admin ON public.offers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = offers.restaurant_id AND r.owner_user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );


-- ====================================================================
-- Done.
-- ====================================================================
