-- 009_clerk_migration.sql
-- Purpose: Migrate from Supabase Auth to Clerk Authentication.
--
-- IMPORTANT: Policies and functions that reference id/user_id columns MUST be
-- dropped BEFORE altering column types, otherwise PostgreSQL raises:
--   "cannot alter type of a column used in a policy definition"
--
-- Order:
--   1. Drop ALL RLS policies on every affected table
--   2. Drop ALL functions that reference id/user_id columns (is_admin, pay_debt_emi, etc.)
--   3. Drop triggers, auth-only tables, legacy columns
--   4. Drop constraints (FKs, PKs, unique)
--   5. Change column types UUID → TEXT
--   6. Re-add constraints
--   7. Create new Clerk-based functions
--   8. Create new Clerk-based RLS policies
--
-- Existing data is preserved — UUID values are cast to TEXT.
-- Run this AFTER backing up your database.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 1: Drop ALL RLS policies on every table that has id/user_id columns
-- This MUST happen BEFORE any ALTER COLUMN TYPE.
-- ═══════════════════════════════════════════════════════════════════════════

-- Dynamically drop every policy on the affected tables so we don't miss any
DO $$
DECLARE
  _table TEXT;
  _pol   TEXT;
BEGIN
  FOR _table IN
    SELECT unnest(ARRAY[
      'profiles', 'transactions', 'debts', 'investments',
      'wishlist', 'credit_scores', 'approval_notifications'
    ])
  LOOP
    FOR _pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = _table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _pol, _table);
    END LOOP;
  END LOOP;
END $$;

-- Also drop policies on tables we're about to drop (just in case)
DO $$
DECLARE _pol TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'otp_challenges') THEN
    FOR _pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'otp_challenges' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.otp_challenges', _pol);
    END LOOP;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_sessions') THEN
    FOR _pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_sessions' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_sessions', _pol);
    END LOOP;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 2: Drop ALL functions that reference affected columns
-- These functions use profiles.id or debts.user_id in their bodies, which
-- also blocks ALTER COLUMN TYPE.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_clerk_admin() CASCADE;
DROP FUNCTION IF EXISTS public.clerk_uid() CASCADE;
DROP FUNCTION IF EXISTS public.pay_debt_emi(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.get_login_email(text) CASCADE;
DROP FUNCTION IF EXISTS public.check_username_available(text) CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 3: Drop Supabase Auth triggers, auth-only tables, legacy columns
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop triggers that depend on legacy columns (approval_status, is_admin)
DROP TRIGGER IF EXISTS enforce_root_admin_trigger ON public.profiles;
DROP TRIGGER IF EXISTS profile_approval_change_trigger ON public.profiles;
-- Drop any other triggers on profiles to be safe
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles', r.tgname);
  END LOOP;
END $$;

-- Drop trigger functions that reference legacy columns
DROP FUNCTION IF EXISTS public.enforce_root_admin() CASCADE;
DROP FUNCTION IF EXISTS public.handle_profile_approval_change() CASCADE;
DROP FUNCTION IF EXISTS public.notify_approval_change() CASCADE;

DROP TABLE IF EXISTS public.otp_challenges CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;

-- Drop legacy columns (CASCADE to catch any remaining dependencies)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS approval_status CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 4: Drop ALL constraints that block ALTER COLUMN TYPE
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop FK from profiles.id → auth.users(id)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Drop FKs from data tables → profiles(id)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'profiles'
      AND ccu.column_name = 'id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
                   r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- Drop FKs from approval_notifications → auth.users(id)
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'approval_notifications') THEN
    FOR r IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.approval_notifications'::regclass
        AND contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.approval_notifications DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
  END IF;
END $$;

-- Drop primary key on profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;

-- Drop unique constraint on credit_scores.user_id
ALTER TABLE public.credit_scores DROP CONSTRAINT IF EXISTS credit_scores_user_id_key;

-- Drop any unique indexes on profiles that reference id
DROP INDEX IF EXISTS idx_profiles_username_unique;
DROP INDEX IF EXISTS idx_profiles_email_unique;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 5: Change column types from UUID to TEXT
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles           ALTER COLUMN id      TYPE TEXT USING id::TEXT;
ALTER TABLE public.transactions       ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.debts              ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.investments        ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.wishlist           ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.credit_scores      ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.approval_notifications ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 6: Re-add primary key, foreign keys, and indexes
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD PRIMARY KEY (id);

-- Recreate unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique ON public.profiles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.debts
  ADD CONSTRAINT debts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.wishlist
  ADD CONSTRAINT wishlist_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.credit_scores
  ADD CONSTRAINT credit_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.credit_scores
  ADD CONSTRAINT credit_scores_user_id_key UNIQUE (user_id);

ALTER TABLE public.approval_notifications
  ADD CONSTRAINT approval_notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 7: Create NEW helper functions (Clerk-based)
-- ═══════════════════════════════════════════════════════════════════════════

-- Get current user's Clerk ID from JWT
CREATE OR REPLACE FUNCTION public.clerk_uid()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '');
$$;

-- Check if current Clerk user is an admin
CREATE OR REPLACE FUNCTION public.is_clerk_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = public.clerk_uid()
      AND p.role = 'admin'
  );
$$;

-- is_admin(TEXT): takes a user ID and checks admin role
CREATE OR REPLACE FUNCTION public.is_admin(uid TEXT)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role = 'admin'
  );
$$;

-- get_login_email: lookup email by username or email
CREATE OR REPLACE FUNCTION public.get_login_email(login_identifier TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
  FROM public.profiles p
  WHERE lower(p.email) = lower(login_identifier)
     OR lower(p.username) = lower(login_identifier)
  LIMIT 1;
$$;

-- check_username_available: returns true if username is free
CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(p_username)
  );
$$;

-- pay_debt_emi: atomic EMI payment using Clerk JWT
CREATE OR REPLACE FUNCTION public.pay_debt_emi(p_debt_id TEXT, p_amount numeric)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.debts
  SET remaining_amount = GREATEST(0, remaining_amount - p_amount)
  WHERE id = p_debt_id
    AND user_id = public.clerk_uid()
  RETURNING remaining_amount;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.clerk_uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_clerk_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_email(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_debt_emi(uuid, numeric) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 8: Create NEW RLS policies using Clerk JWT claims
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure RLS is enabled
ALTER TABLE public.profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_notifications   ENABLE ROW LEVEL SECURITY;

-- profiles: select own or admin can see all
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
    id = public.clerk_uid()
    OR public.is_clerk_admin()
  );

-- profiles: anyone can register (insert pending profile)
CREATE POLICY "profiles_insert_registration" ON public.profiles
  FOR INSERT WITH CHECK (
    id = public.clerk_uid()
    OR (status = 'pending' AND role = 'user')
  );

-- profiles: update own or admin
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE USING (
    id = public.clerk_uid()
    OR public.is_clerk_admin()
  ) WITH CHECK (
    id = public.clerk_uid()
    OR public.is_clerk_admin()
  );

-- profiles: delete own only
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (id = public.clerk_uid());

-- transactions
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT USING (user_id = public.clerk_uid());
CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT WITH CHECK (user_id = public.clerk_uid());
CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE USING (user_id = public.clerk_uid());
CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE USING (user_id = public.clerk_uid());

-- debts
CREATE POLICY "debts_select_own" ON public.debts
  FOR SELECT USING (user_id = public.clerk_uid());
CREATE POLICY "debts_insert_own" ON public.debts
  FOR INSERT WITH CHECK (user_id = public.clerk_uid());
CREATE POLICY "debts_update_own" ON public.debts
  FOR UPDATE USING (user_id = public.clerk_uid());
CREATE POLICY "debts_delete_own" ON public.debts
  FOR DELETE USING (user_id = public.clerk_uid());

-- investments
CREATE POLICY "investments_select_own" ON public.investments
  FOR SELECT USING (user_id = public.clerk_uid());
CREATE POLICY "investments_insert_own" ON public.investments
  FOR INSERT WITH CHECK (user_id = public.clerk_uid());
CREATE POLICY "investments_update_own" ON public.investments
  FOR UPDATE USING (user_id = public.clerk_uid());
CREATE POLICY "investments_delete_own" ON public.investments
  FOR DELETE USING (user_id = public.clerk_uid());

-- wishlist
CREATE POLICY "wishlist_select_own" ON public.wishlist
  FOR SELECT USING (user_id = public.clerk_uid());
CREATE POLICY "wishlist_insert_own" ON public.wishlist
  FOR INSERT WITH CHECK (user_id = public.clerk_uid());
CREATE POLICY "wishlist_update_own" ON public.wishlist
  FOR UPDATE USING (user_id = public.clerk_uid());
CREATE POLICY "wishlist_delete_own" ON public.wishlist
  FOR DELETE USING (user_id = public.clerk_uid());

-- credit_scores
CREATE POLICY "credit_scores_select_own" ON public.credit_scores
  FOR SELECT USING (user_id = public.clerk_uid());
CREATE POLICY "credit_scores_insert_own" ON public.credit_scores
  FOR INSERT WITH CHECK (user_id = public.clerk_uid());
CREATE POLICY "credit_scores_update_own" ON public.credit_scores
  FOR UPDATE USING (user_id = public.clerk_uid());
CREATE POLICY "credit_scores_delete_own" ON public.credit_scores
  FOR DELETE USING (user_id = public.clerk_uid());

-- approval_notifications: user can read own, admin can read all
CREATE POLICY "approval_notifications_select" ON public.approval_notifications
  FOR SELECT USING (user_id = public.clerk_uid() OR public.is_clerk_admin());
CREATE POLICY "approval_notifications_insert" ON public.approval_notifications
  FOR INSERT WITH CHECK (public.is_clerk_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 9: Ensure the root admin profile is still properly flagged
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.profiles
SET role   = 'admin',
    status = 'approved'
WHERE lower(email) = 'sriramparisa0x@gmail.com';

COMMIT;
