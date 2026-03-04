-- 004_investments.sql
-- Purpose: Define investments table, planning columns/constraints, and investment indexes.

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

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS goal_name text,
  ADD COLUMN IF NOT EXISTS target_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_annual_return numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tenure_months int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'medium';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'investments_risk_level_check'
      AND conrelid = 'public.investments'::regclass
  ) THEN
    ALTER TABLE public.investments
      ADD CONSTRAINT investments_risk_level_check
      CHECK (risk_level IN ('low', 'medium', 'high'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
