-- 002_transactions.sql
-- Purpose: Define transactions table and transaction indexes.

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

CREATE INDEX IF NOT EXISTS idx_transactions_user_id  ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date      ON public.transactions(date DESC);
