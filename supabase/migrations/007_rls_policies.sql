-- 007_rls_policies.sql
-- Purpose: Enable RLS and define all Row Level Security policies across tables.

-- enable row level security
ALTER TABLE public.profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_notifications   ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"  ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"  ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin(auth.uid())) WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"  ON public.profiles FOR DELETE USING (auth.uid() = id);

-- transactions
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own"  ON public.transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own"  ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own"  ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own"  ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- debts
DROP POLICY IF EXISTS "debts_select_own" ON public.debts;
CREATE POLICY "debts_select_own"  ON public.debts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "debts_insert_own" ON public.debts;
CREATE POLICY "debts_insert_own"  ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "debts_update_own" ON public.debts;
CREATE POLICY "debts_update_own"  ON public.debts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "debts_delete_own" ON public.debts;
CREATE POLICY "debts_delete_own"  ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- investments
DROP POLICY IF EXISTS "investments_select_own" ON public.investments;
CREATE POLICY "investments_select_own"  ON public.investments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "investments_insert_own" ON public.investments;
CREATE POLICY "investments_insert_own"  ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "investments_update_own" ON public.investments;
CREATE POLICY "investments_update_own"  ON public.investments FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "investments_delete_own" ON public.investments;
CREATE POLICY "investments_delete_own"  ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- wishlist
DROP POLICY IF EXISTS "wishlist_select_own" ON public.wishlist;
CREATE POLICY "wishlist_select_own"  ON public.wishlist FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wishlist_insert_own" ON public.wishlist;
CREATE POLICY "wishlist_insert_own"  ON public.wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wishlist_update_own" ON public.wishlist;
CREATE POLICY "wishlist_update_own"  ON public.wishlist FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wishlist_delete_own" ON public.wishlist;
CREATE POLICY "wishlist_delete_own"  ON public.wishlist FOR DELETE USING (auth.uid() = user_id);

-- credit_scores
DROP POLICY IF EXISTS "credit_scores_select_own" ON public.credit_scores;
CREATE POLICY "credit_scores_select_own"  ON public.credit_scores FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "credit_scores_insert_own" ON public.credit_scores;
CREATE POLICY "credit_scores_insert_own"  ON public.credit_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "credit_scores_update_own" ON public.credit_scores;
CREATE POLICY "credit_scores_update_own"  ON public.credit_scores FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "credit_scores_delete_own" ON public.credit_scores;
CREATE POLICY "credit_scores_delete_own"  ON public.credit_scores FOR DELETE USING (auth.uid() = user_id);

-- otp_challenges
DROP POLICY IF EXISTS otp_challenges_select_own_or_admin ON public.otp_challenges;
CREATE POLICY otp_challenges_select_own_or_admin
  ON public.otp_challenges FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(coalesce(email, '')) = lower((auth.jwt() ->> 'email'))
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS otp_challenges_insert_own_or_admin ON public.otp_challenges;
CREATE POLICY otp_challenges_insert_own_or_admin
  ON public.otp_challenges FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR lower(coalesce(email, '')) = lower((auth.jwt() ->> 'email'))
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS otp_challenges_update_own_or_admin ON public.otp_challenges;
CREATE POLICY otp_challenges_update_own_or_admin
  ON public.otp_challenges FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS otp_challenges_delete_own_or_admin ON public.otp_challenges;
CREATE POLICY otp_challenges_delete_own_or_admin
  ON public.otp_challenges FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- user_sessions
DROP POLICY IF EXISTS user_sessions_select_own_or_admin ON public.user_sessions;
CREATE POLICY user_sessions_select_own_or_admin
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS user_sessions_insert_own_or_admin ON public.user_sessions;
CREATE POLICY user_sessions_insert_own_or_admin
  ON public.user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS user_sessions_update_own_or_admin ON public.user_sessions;
CREATE POLICY user_sessions_update_own_or_admin
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS user_sessions_delete_own_or_admin ON public.user_sessions;
CREATE POLICY user_sessions_delete_own_or_admin
  ON public.user_sessions FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- approval_notifications
DROP POLICY IF EXISTS approval_notifications_select_own_or_admin ON public.approval_notifications;
CREATE POLICY approval_notifications_select_own_or_admin
  ON public.approval_notifications FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS approval_notifications_insert_admin ON public.approval_notifications;
CREATE POLICY approval_notifications_insert_admin
  ON public.approval_notifications FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS approval_notifications_update_own ON public.approval_notifications;
CREATE POLICY approval_notifications_update_own
  ON public.approval_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- strict profile update policy replacement
-- Admin can update anything. Non-admin users cannot change their own
-- is_admin, approval_status, role, or status columns.
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (
      auth.uid() = id
      AND is_admin  = (SELECT p.is_admin FROM public.profiles p WHERE p.id = id)
      AND role      = (SELECT p.role FROM public.profiles p WHERE p.id = id)
      AND status    = (SELECT p.status FROM public.profiles p WHERE p.id = id)
      AND approval_status = (SELECT p.approval_status FROM public.profiles p WHERE p.id = id)
    )
  );
