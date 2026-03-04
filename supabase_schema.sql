-- ============================================================
-- FinanceBuddy – Complete Supabase Schema
-- Run this entire file once in the Supabase SQL Editor.
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABLES
-- ============================================================

-- a) profiles (linked 1-to-1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name                  text NOT NULL,
  username              text UNIQUE,
  email                 text,
  monthly_income        numeric DEFAULT 0,
  monthly_savings_target numeric DEFAULT 0,
  avatar_url            text,
  is_admin              boolean NOT NULL DEFAULT false,
  approval_status       text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at            timestamptz DEFAULT now()
);

-- b) transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      numeric NOT NULL CHECK (amount > 0),
  type        text NOT NULL CHECK (type IN ('income', 'expense')),
  category    text NOT NULL,
  description text,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz DEFAULT now()
);

-- c) debts
CREATE TABLE IF NOT EXISTS public.debts (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  type                 text NOT NULL DEFAULT 'bank',
  total_amount         numeric NOT NULL DEFAULT 0,
  remaining_amount     numeric NOT NULL DEFAULT 0,
  interest_rate        numeric NOT NULL DEFAULT 0,
  monthly_emi          numeric NOT NULL DEFAULT 0,
  due_date             int NOT NULL DEFAULT 1,
  is_paused            boolean DEFAULT false,
  created_at           timestamptz DEFAULT now()
);

-- d) investments
CREATE TABLE IF NOT EXISTS public.investments (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN ('stock','mutual_fund','fd','gold','real_estate','crypto','custom','other')),
  invested_amount  numeric NOT NULL,
  current_value    numeric NOT NULL,
  last_updated     text,
  notes            text,
  created_at       timestamptz DEFAULT now()
);

-- e) wishlist
CREATE TABLE IF NOT EXISTS public.wishlist (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           text NOT NULL,
  category       text DEFAULT 'want',
  estimated_cost numeric NOT NULL,
  priority       text CHECK (priority IN ('low','medium','high')),
  status         text DEFAULT 'added',
  view_count     int DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- f) credit_scores
CREATE TABLE IF NOT EXISTS public.credit_scores (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  cibil      int CHECK (cibil BETWEEN 300 AND 900),
  experian   int CHECK (experian BETWEEN 300 AND 900),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_scores      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid AND p.is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_login_email(login_identifier text)
RETURNS text
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

GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;

-- Returns TRUE if the username is not already taken (case-insensitive).
-- Called by the frontend during registration before creating the auth user,
-- so the anon role must have EXECUTE permission.
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(username) = lower(p_username)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Atomic EMI payment: decrements remaining_amount in a single SQL statement
-- preventing read-modify-write races when a user pays from two tabs
CREATE OR REPLACE FUNCTION public.pay_debt_emi(p_debt_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.debts
  SET remaining_amount = GREATEST(0, remaining_amount - p_amount)
  WHERE id = p_debt_id
    AND user_id = auth.uid()
  RETURNING remaining_amount;
$$;

GRANT EXECUTE ON FUNCTION public.pay_debt_emi(uuid, numeric) TO authenticated;

-- profiles
CREATE POLICY "profiles_select_own_or_admin"  ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own_or_admin"  ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin(auth.uid())) WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_delete_own"  ON public.profiles FOR DELETE USING (auth.uid() = id);

-- transactions
CREATE POLICY "transactions_select_own"  ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own"  ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own"  ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own"  ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- debts
CREATE POLICY "debts_select_own"  ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "debts_insert_own"  ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debts_update_own"  ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "debts_delete_own"  ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- investments
CREATE POLICY "investments_select_own"  ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "investments_insert_own"  ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "investments_update_own"  ON public.investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "investments_delete_own"  ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- wishlist
CREATE POLICY "wishlist_select_own"  ON public.wishlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wishlist_insert_own"  ON public.wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wishlist_update_own"  ON public.wishlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "wishlist_delete_own"  ON public.wishlist FOR DELETE USING (auth.uid() = user_id);

-- credit_scores
CREATE POLICY "credit_scores_select_own"  ON public.credit_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "credit_scores_insert_own"  ON public.credit_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credit_scores_update_own"  ON public.credit_scores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "credit_scores_delete_own"  ON public.credit_scores FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_suffix   text;
BEGIN
  -- Desired username from metadata, falling back to email local-part
  v_username := lower(COALESCE(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  ));

  -- If username is already taken (case-insensitive index), append first 6 chars of uid
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = v_username
  ) THEN
    v_suffix   := substr(replace(new.id::text, '-', ''), 1, 6);
    v_username := v_username || '_' || v_suffix;
  END IF;

  INSERT INTO public.profiles (id, name, username, email, approval_status, is_admin)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    v_username,
    new.email,
    CASE WHEN lower(new.email) = 'sriramparisa0x@gmail.com' THEN 'approved' ELSE 'pending' END,
    CASE WHEN lower(new.email) = 'sriramparisa0x@gmail.com' THEN true ELSE false END
  )
  ON CONFLICT (id) DO UPDATE
  SET name  = EXCLUDED.name,
      email = EXCLUDED.email;
  -- Note: username is NOT updated on conflict to preserve the user's chosen handle

  INSERT INTO public.credit_scores (user_id, cibil, experian)
  VALUES (new.id, null, null)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_user_id  ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date      ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_debts_user_id          ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id    ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id       ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_user_id  ON public.credit_scores(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique ON public.profiles (lower(username));

-- ============================================================
-- 7. DEFAULT SINGLE ADMIN
-- ============================================================

UPDATE public.profiles
SET is_admin = false
WHERE lower(coalesce(email, '')) <> 'sriramparisa0x@gmail.com';

UPDATE public.profiles
SET username = username || '_user'
WHERE lower(coalesce(username, '')) = 'buddy'
  AND lower(coalesce(email, '')) <> 'sriramparisa0x@gmail.com';

UPDATE public.profiles
SET is_admin = true,
    approval_status = 'approved',
    username = 'buddy'
WHERE lower(email) = 'sriramparisa0x@gmail.com';
