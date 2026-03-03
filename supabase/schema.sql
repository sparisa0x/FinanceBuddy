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
  monthly_income        numeric DEFAULT 0,
  monthly_savings_target numeric DEFAULT 0,
  avatar_url            text,
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
  principal            numeric NOT NULL,
  outstanding_principal numeric NOT NULL,
  annual_rate          numeric NOT NULL,
  tenure_months        int NOT NULL,
  start_date           date NOT NULL,
  lender               text,
  created_at           timestamptz DEFAULT now()
);

-- d) investments
CREATE TABLE IF NOT EXISTS public.investments (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN ('stocks','mutual_fund','fd','gold','real_estate','crypto','other')),
  invested_amount  numeric NOT NULL,
  current_value    numeric NOT NULL,
  date             date NOT NULL,
  notes            text,
  created_at       timestamptz DEFAULT now()
);

-- e) wishlist
CREATE TABLE IF NOT EXISTS public.wishlist (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           text NOT NULL,
  estimated_cost numeric NOT NULL,
  priority       text CHECK (priority IN ('low','medium','high')),
  target_date    date,
  is_purchased   boolean DEFAULT false,
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

-- g) net_worth_snapshots
CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  net_worth     numeric NOT NULL,
  total_assets  numeric NOT NULL,
  total_debts   numeric NOT NULL,
  created_at    timestamptz DEFAULT now()
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
ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "profiles_select_own"  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (auth.uid() = id);
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

-- net_worth_snapshots
CREATE POLICY "snapshots_select_own"  ON public.net_worth_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "snapshots_insert_own"  ON public.net_worth_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "snapshots_update_own"  ON public.net_worth_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "snapshots_delete_own"  ON public.net_worth_snapshots FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
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
CREATE INDEX IF NOT EXISTS idx_snapshots_user_id      ON public.net_worth_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date         ON public.net_worth_snapshots(snapshot_date DESC);
