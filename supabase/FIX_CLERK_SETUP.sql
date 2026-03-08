-- FIX_CLERK_SETUP.sql
-- Run this in Supabase SQL Editor to fix the partial / failed migration.
-- It is safe to run multiple times (all commands are idempotent).
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste this file → Run

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Drop ALL existing RLS policies on affected tables (clean slate)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  _table TEXT;
  _pol   TEXT;
BEGIN
  FOR _table IN SELECT unnest(ARRAY[
    'profiles','transactions','debts','investments',
    'wishlist','credit_scores','approval_notifications'
  ]) LOOP
    FOR _pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = _table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _pol, _table);
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop & recreate helper functions
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.clerk_uid() CASCADE;
DROP FUNCTION IF EXISTS public.is_clerk_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.pay_debt_emi(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.pay_debt_emi(text, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.get_login_email(text) CASCADE;
DROP FUNCTION IF EXISTS public.check_username_available(text) CASCADE;

-- Reads the Clerk user ID from the JWT claim
CREATE OR REPLACE FUNCTION public.clerk_uid()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '');
$$;

-- True when the calling Clerk user has role = 'admin'
CREATE OR REPLACE FUNCTION public.is_clerk_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id::text = public.clerk_uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(uid TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id::text = uid AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.get_login_email(login_identifier TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.email FROM public.profiles p
  WHERE lower(p.email) = lower(login_identifier)
     OR lower(p.username) = lower(login_identifier)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(p_username)
  );
$$;

CREATE OR REPLACE FUNCTION public.pay_debt_emi(p_debt_id TEXT, p_amount numeric)
RETURNS numeric LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.debts
  SET remaining_amount = GREATEST(0, remaining_amount - p_amount)
  WHERE id::text = p_debt_id AND user_id::text = public.clerk_uid()
  RETURNING remaining_amount;
$$;

GRANT EXECUTE ON FUNCTION public.clerk_uid()               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_clerk_admin()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_email(TEXT)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_debt_emi(TEXT, numeric)    TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ensure column types are TEXT (safe no-op if already TEXT)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- profiles.id
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name='id') <> 'text' THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
    ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::TEXT;
    ALTER TABLE public.profiles ADD PRIMARY KEY (id);
  END IF;

  -- transactions.user_id
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='transactions' AND column_name='user_id') <> 'text' THEN
    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
    ALTER TABLE public.transactions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;

  -- debts.user_id
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='debts' AND column_name='user_id') <> 'text' THEN
    ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_user_id_fkey;
    ALTER TABLE public.debts ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;

  -- investments.user_id
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='investments' AND column_name='user_id') <> 'text' THEN
    ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
    ALTER TABLE public.investments ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;

  -- wishlist.user_id
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='wishlist' AND column_name='user_id') <> 'text' THEN
    ALTER TABLE public.wishlist DROP CONSTRAINT IF EXISTS wishlist_user_id_fkey;
    ALTER TABLE public.wishlist ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;

  -- credit_scores.user_id
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='credit_scores' AND column_name='user_id') <> 'text' THEN
    ALTER TABLE public.credit_scores DROP CONSTRAINT IF EXISTS credit_scores_user_id_fkey;
    ALTER TABLE public.credit_scores DROP CONSTRAINT IF EXISTS credit_scores_user_id_key;
    ALTER TABLE public.credit_scores ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;

  -- approval_notifications.user_id
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='approval_notifications') THEN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='approval_notifications' AND column_name='user_id') <> 'text' THEN
      ALTER TABLE public.approval_notifications DROP CONSTRAINT IF EXISTS approval_notifications_user_id_fkey;
      ALTER TABLE public.approval_notifications ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;
  END IF;
END $$;

-- Recreate FKs and unique constraints
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.debts
  DROP CONSTRAINT IF EXISTS debts_user_id_fkey;
ALTER TABLE public.debts
  ADD CONSTRAINT debts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.wishlist
  DROP CONSTRAINT IF EXISTS wishlist_user_id_fkey;
ALTER TABLE public.wishlist
  ADD CONSTRAINT wishlist_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.credit_scores
  DROP CONSTRAINT IF EXISTS credit_scores_user_id_fkey;
ALTER TABLE public.credit_scores
  ADD CONSTRAINT credit_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.credit_scores
  DROP CONSTRAINT IF EXISTS credit_scores_user_id_key;
ALTER TABLE public.credit_scores
  ADD CONSTRAINT credit_scores_user_id_key UNIQUE (user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='approval_notifications') THEN
    ALTER TABLE public.approval_notifications
      DROP CONSTRAINT IF EXISTS approval_notifications_user_id_fkey;
    ALTER TABLE public.approval_notifications
      ADD CONSTRAINT approval_notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Enable RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_scores          ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='approval_notifications') THEN
    ALTER TABLE public.approval_notifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (id::text = public.clerk_uid() OR public.is_clerk_admin());

-- Allow insert with matching JWT sub, OR allow a pending/user insert (bootstrap without JWT)
CREATE POLICY "profiles_insert_registration" ON public.profiles
  FOR INSERT WITH CHECK (
    id::text = public.clerk_uid()
    OR (status = 'pending' AND role = 'user')
  );

CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE USING (id::text = public.clerk_uid() OR public.is_clerk_admin())
  WITH CHECK (id::text = public.clerk_uid() OR public.is_clerk_admin());

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (id::text = public.clerk_uid());

-- transactions
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (user_id::text = public.clerk_uid());
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT WITH CHECK (user_id::text = public.clerk_uid());
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE USING (user_id::text = public.clerk_uid());
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE USING (user_id::text = public.clerk_uid());

-- debts
CREATE POLICY "debts_select_own" ON public.debts FOR SELECT USING (user_id::text = public.clerk_uid());
CREATE POLICY "debts_insert_own" ON public.debts FOR INSERT WITH CHECK (user_id::text = public.clerk_uid());
CREATE POLICY "debts_update_own" ON public.debts FOR UPDATE USING (user_id::text = public.clerk_uid());
CREATE POLICY "debts_delete_own" ON public.debts FOR DELETE USING (user_id::text = public.clerk_uid());

-- investments
CREATE POLICY "investments_select_own" ON public.investments FOR SELECT USING (user_id::text = public.clerk_uid());
CREATE POLICY "investments_insert_own" ON public.investments FOR INSERT WITH CHECK (user_id::text = public.clerk_uid());
CREATE POLICY "investments_update_own" ON public.investments FOR UPDATE USING (user_id::text = public.clerk_uid());
CREATE POLICY "investments_delete_own" ON public.investments FOR DELETE USING (user_id::text = public.clerk_uid());

-- wishlist
CREATE POLICY "wishlist_select_own" ON public.wishlist FOR SELECT USING (user_id::text = public.clerk_uid());
CREATE POLICY "wishlist_insert_own" ON public.wishlist FOR INSERT WITH CHECK (user_id::text = public.clerk_uid());
CREATE POLICY "wishlist_update_own" ON public.wishlist FOR UPDATE USING (user_id::text = public.clerk_uid());
CREATE POLICY "wishlist_delete_own" ON public.wishlist FOR DELETE USING (user_id::text = public.clerk_uid());

-- credit_scores
CREATE POLICY "credit_scores_select_own" ON public.credit_scores FOR SELECT USING (user_id::text = public.clerk_uid());
CREATE POLICY "credit_scores_insert_own" ON public.credit_scores FOR INSERT WITH CHECK (user_id::text = public.clerk_uid());
CREATE POLICY "credit_scores_update_own" ON public.credit_scores FOR UPDATE USING (user_id::text = public.clerk_uid());
CREATE POLICY "credit_scores_delete_own" ON public.credit_scores FOR DELETE USING (user_id::text = public.clerk_uid());

-- approval_notifications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='approval_notifications') THEN
    EXECUTE $pol$
      CREATE POLICY "approval_notifications_select" ON public.approval_notifications
        FOR SELECT USING (user_id::text = public.clerk_uid() OR public.is_clerk_admin());
      CREATE POLICY "approval_notifications_insert" ON public.approval_notifications
        FOR INSERT WITH CHECK (public.is_clerk_admin());
    $pol$;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Promote the app owner to admin (update email below if different)
-- ─────────────────────────────────────────────────────────────────────────────
-- Promote admin by email — works regardless of column type
UPDATE public.profiles
SET role   = 'admin',
    status = 'approved'
WHERE lower(email) = 'sriramparisa0x@gmail.com';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Add 'role' and 'status' columns to profiles if somehow missing
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role   TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

COMMIT;
