-- Phase 2c: RLS policies for claims.
--
-- Idempotent — every CREATE has a matching DROP IF EXISTS.
-- Applied via `npm run setup:claim-policies`.


-- ====================================================================
-- SELECT layers (OR'd):
--   - Diner reads their own claims
--   - Merchant reads claims for offers from their own restaurant
--   - Admin reads everything
-- ====================================================================

DROP POLICY IF EXISTS claims_select_diner_own ON public.claims;
CREATE POLICY claims_select_diner_own ON public.claims
  FOR SELECT
  USING (diner_user_id = auth.uid());

DROP POLICY IF EXISTS claims_select_merchant_own_restaurant ON public.claims;
CREATE POLICY claims_select_merchant_own_restaurant ON public.claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE o.id = claims.offer_id AND r.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS claims_select_admin ON public.claims;
CREATE POLICY claims_select_admin ON public.claims
  FOR SELECT
  USING (public.current_user_role() = 'admin');


-- ====================================================================
-- INSERT: only diners, only for themselves, only against a live offer
-- from an approved restaurant. Per-diner / per-offer caps are NOT
-- enforced here — they're enforced in the server action before insert
-- (good enough at pilot scale; revisit if we see race-condition abuse).
-- ====================================================================

DROP POLICY IF EXISTS claims_insert_diner_self ON public.claims;
CREATE POLICY claims_insert_diner_self ON public.claims
  FOR INSERT
  WITH CHECK (
    diner_user_id = auth.uid()
    AND public.current_user_role() = 'diner'
    AND EXISTS (
      SELECT 1 FROM public.offers o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE o.id = claims.offer_id
        AND o.status = 'live'
        AND r.status = 'approved'
    )
  );


-- ====================================================================
-- UPDATE:
--   - Diner can update their own (used for cancel)
--   - Merchant can update claims for their offers (used for consumed
--     marking in Phase 2d/e)
--   - Admin can update anything
-- ====================================================================

DROP POLICY IF EXISTS claims_update_diner_own ON public.claims;
CREATE POLICY claims_update_diner_own ON public.claims
  FOR UPDATE
  USING (diner_user_id = auth.uid());

DROP POLICY IF EXISTS claims_update_merchant_or_admin ON public.claims;
CREATE POLICY claims_update_merchant_or_admin ON public.claims
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE o.id = claims.offer_id AND r.owner_user_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );


-- ====================================================================
-- No DELETE policy: claims are soft-deleted via status='cancelled' or
-- 'expired'. Admin can DELETE only via service-role (RLS bypass) for
-- data-cleanup operations.
-- ====================================================================
