-- RLS for menu_items.
--
-- All access runs through the service-role client — the diner menu
-- screen and the merchant menu manager — gated in app code by the
-- calling route (requireRole + restaurant ownership). RLS is enabled
-- with no policies: deny-all to the user-scoped client, defense in
-- depth.
--
-- Idempotent. Applied via `npm run setup:menu-policies`.

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
