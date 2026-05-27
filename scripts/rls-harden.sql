-- RLS hardening — explicit ENABLE ROW LEVEL SECURITY on every
-- application table. Idempotent (re-enabling RLS on a table that
-- already has it on is a no-op).
--
-- Background: the original Phase-0 `enable-rls.ts` only knew the 8
-- bootstrap tables, two of which (`cards`, `payments`) were retired
-- in the rebate-model refactor. Tables added later (rebate flow,
-- Plaid items, Dwolla/Astra accounts, billing customers, menu) got
-- RLS only when their per-feature setup script enabled it — and
-- most of them only created policies without enabling RLS, leaving
-- the table publicly accessible.
--
-- This script is the catch-all. Run it whenever a new table is
-- added to be sure RLS is on.

ALTER TABLE public.users                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_stripe_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_items                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_card_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diner_dwolla_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diner_astra_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matched_transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebates                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_billing_customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events                  ENABLE ROW LEVEL SECURITY;
