-- Phase 2d: RLS policies for cards, payments, stripe_events.
--
-- Idempotent. Applied via `npm run setup:payment-policies`.


-- ====================================================================
-- cards
-- ====================================================================
-- Diner owns cards. Diner reads, inserts, updates, deletes their own.
-- Admin reads everything (read-only — admins don't add/remove diner cards).

DROP POLICY IF EXISTS cards_select_owner_or_admin ON public.cards;
CREATE POLICY cards_select_owner_or_admin ON public.cards
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS cards_insert_owner_self ON public.cards;
CREATE POLICY cards_insert_owner_self ON public.cards
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cards_update_owner_self ON public.cards;
CREATE POLICY cards_update_owner_self ON public.cards
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS cards_delete_owner_self ON public.cards;
CREATE POLICY cards_delete_owner_self ON public.cards
  FOR DELETE
  USING (user_id = auth.uid());


-- ====================================================================
-- payments
-- ====================================================================
-- SELECT (OR'd):
--   - Diner reads payments for claims they made
--   - Merchant reads payments for claims against their offers
--   - Admin reads everything

DROP POLICY IF EXISTS payments_select_diner_own ON public.payments;
CREATE POLICY payments_select_diner_own ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = payments.claim_id AND c.diner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payments_select_merchant_own_restaurant ON public.payments;
CREATE POLICY payments_select_merchant_own_restaurant ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.offers o ON o.id = c.offer_id
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE c.id = payments.claim_id AND r.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payments_select_admin ON public.payments;
CREATE POLICY payments_select_admin ON public.payments
  FOR SELECT
  USING (public.current_user_role() = 'admin');

-- INSERT: a diner inserts a payment only for their own claim. Card
-- ownership is verified at the app layer (RLS would need a 4-way join).
DROP POLICY IF EXISTS payments_insert_diner_own_claim ON public.payments;
CREATE POLICY payments_insert_diner_own_claim ON public.payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = payments.claim_id AND c.diner_user_id = auth.uid()
    )
  );

-- UPDATE: payments are immutable from user sessions. The Stripe webhook
-- handler bypasses RLS via the service role to update reconciliation
-- fields (auto_approval_status, flagged_reasons, reviewed_*). Admin can
-- update via service role too. No user-facing UPDATE policy.

-- DELETE: never from user sessions.


-- ====================================================================
-- stripe_events
-- ====================================================================
-- Audit-only for admins. Writes happen exclusively from the webhook
-- handler using the service role (bypasses RLS).

DROP POLICY IF EXISTS stripe_events_select_admin ON public.stripe_events;
CREATE POLICY stripe_events_select_admin ON public.stripe_events
  FOR SELECT
  USING (public.current_user_role() = 'admin');
