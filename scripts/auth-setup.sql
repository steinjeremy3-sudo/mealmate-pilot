-- Phase 1: bridge Supabase Auth (auth.users) to application user table
-- (public.users), plus base RLS policies.
--
-- This entire file is idempotent — every CREATE has a matching DROP IF EXISTS
-- before it. Safe to re-run.
--
-- Applied via `npm run setup:auth` (scripts/setup-auth.ts).


-- ====================================================================
-- 1. handle_new_user trigger
-- ====================================================================
-- When Supabase Auth creates a row in auth.users (sign-up), this trigger
-- mirrors a row into public.users with the matching id, copying role and
-- display_name out of raw_user_meta_data.
--
-- The role is set in the sign-up call's `options.data` field. Web sign-up
-- only offers `merchant`. Mobile (Phase 1.5+) will set `diner`. `admin` is
-- created by hand in the Supabase dashboard (or via SQL with the service
-- role) — there is no web sign-up path for admin.
--
-- SECURITY DEFINER lets the trigger insert into public.users even though
-- the calling session's RLS would normally block it. The function runs as
-- the function owner (postgres) with elevated privileges. `search_path` is
-- pinned to defend against search-path attacks.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_display_name text;
BEGIN
  -- Role from metadata; defaults to 'merchant' (web sign-up).
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'role', '')::public.user_role,
    'merchant'::public.user_role
  );

  -- Display name from metadata; falls back to email local-part.
  v_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (id, email, role, display_name)
  VALUES (NEW.id, NEW.email, v_role, v_display_name)
  ON CONFLICT (id) DO NOTHING;  -- defensive: re-running won't error

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ====================================================================
-- 2. current_user_role() helper
-- ====================================================================
-- RLS policies often need to know "is the current user an admin?" Doing
-- that with a subquery against public.users inside the policy creates
-- infinite recursion (the policy queries users, which triggers the same
-- policy, which queries users, ...). The standard Supabase fix is a
-- SECURITY DEFINER function that runs outside RLS.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;


-- ====================================================================
-- 3. RLS policies — users
-- ====================================================================
-- A user can read and update their own row. Admins can read and update
-- every row. INSERT is handled exclusively by the handle_new_user trigger
-- (no direct user insert). DELETE is admin-only (we soft-delete via the
-- status enum in normal flows).

DROP POLICY IF EXISTS users_select_self_or_admin ON public.users;
CREATE POLICY users_select_self_or_admin ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS users_update_self_or_admin ON public.users;
CREATE POLICY users_update_self_or_admin ON public.users
  FOR UPDATE
  USING (
    id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS users_delete_admin_only ON public.users;
CREATE POLICY users_delete_admin_only ON public.users
  FOR DELETE
  USING (public.current_user_role() = 'admin');

-- No INSERT policy on purpose: the trigger uses SECURITY DEFINER and
-- bypasses RLS. Direct INSERTs from app code will fail.


-- ====================================================================
-- 4. RLS policies — restaurants
-- ====================================================================
-- Merchant: read + update only their own restaurants (owner_user_id =
-- self), and insert restaurants that name themselves as owner.
-- Admin: full access.
-- Diners: cannot see anything via RLS in Phase 1. (Public offer discovery
-- in Phase 2 will get its own policy.)

DROP POLICY IF EXISTS restaurants_select_owner_or_admin ON public.restaurants;
CREATE POLICY restaurants_select_owner_or_admin ON public.restaurants
  FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS restaurants_insert_merchant_self ON public.restaurants;
CREATE POLICY restaurants_insert_merchant_self ON public.restaurants
  FOR INSERT
  WITH CHECK (
    owner_user_id = auth.uid()
    AND public.current_user_role() = 'merchant'
  );

DROP POLICY IF EXISTS restaurants_update_owner_or_admin ON public.restaurants;
CREATE POLICY restaurants_update_owner_or_admin ON public.restaurants
  FOR UPDATE
  USING (
    owner_user_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS restaurants_delete_admin_only ON public.restaurants;
CREATE POLICY restaurants_delete_admin_only ON public.restaurants
  FOR DELETE
  USING (public.current_user_role() = 'admin');


-- ====================================================================
-- 5. RLS policies — other tables (Phase 1: locked down)
-- ====================================================================
-- For tables the web app doesn't yet read or write (offers, claims, cards,
-- payments, audit_log, stripe_events), Phase 1 leaves RLS enabled with NO
-- policies, which means: deny everything to authenticated users.
-- Service-role server code (admin client) bypasses RLS and still works.
-- Phase 2+ adds per-table policies as features come online.


-- ====================================================================
-- Done.
-- ====================================================================
