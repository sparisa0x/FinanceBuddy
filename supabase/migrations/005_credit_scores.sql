-- 005_credit_scores.sql
-- Purpose: Define credit_scores table and related indexes.

CREATE TABLE IF NOT EXISTS public.credit_scores (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  cibil      int CHECK (cibil BETWEEN 300 AND 900),
  experian   int CHECK (experian BETWEEN 300 AND 900),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_scores_user_id  ON public.credit_scores(user_id);
