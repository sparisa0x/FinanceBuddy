-- 003_debts.sql
-- Purpose: Define debts table, debt compatibility alter, and debt indexes.

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

-- Ensure remaining_amount column exists (safe for re-runs on existing tables)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'remaining_amount'
  ) THEN
    ALTER TABLE public.debts ADD COLUMN remaining_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);
