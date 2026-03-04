-- 008_functions.sql
-- Purpose: Define SQL/PLpgSQL functions, grants, and related triggers/procedures.
-- NOTE: Each function uses CREATE OR REPLACE so this file is idempotent.

-- ─── is_admin (checks both new role column AND legacy is_admin boolean) ───────
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
    WHERE p.id = uid
      AND (p.role = 'admin' OR p.is_admin = true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

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

-- ─── handle_new_user: auto-create profile row on auth.users INSERT ────────────
-- Sets BOTH old (approval_status, is_admin) AND new (role, status) columns.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_suffix   text;
  v_role     text;
  v_status   text;
BEGIN
  v_username := lower(COALESCE(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  ));

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = v_username
  ) THEN
    v_suffix   := substr(replace(new.id::text, '-', ''), 1, 6);
    v_username := v_username || '_' || v_suffix;
  END IF;

  IF lower(new.email) = 'sriramparisa0x@gmail.com' THEN
    v_role   := 'admin';
    v_status := 'approved';
  ELSE
    v_role   := 'user';
    v_status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, name, username, email, role, status, approval_status, is_admin)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    v_username,
    new.email,
    v_role,
    v_status,
    v_status,
    (v_role = 'admin')
  )
  ON CONFLICT (id) DO UPDATE
  SET name            = EXCLUDED.name,
      email           = EXCLUDED.email,
      role            = EXCLUDED.role,
      status          = EXCLUDED.status,
      approval_status = EXCLUDED.approval_status,
      is_admin        = EXCLUDED.is_admin;

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

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.touch_session_activity(p_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_sessions
  SET last_active_at = now(),
      expires_at = GREATEST(expires_at, now() + interval '5 days')
  WHERE id = p_session_id
    AND revoked_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.touch_session_activity(uuid) TO authenticated;

-- ─── on_profile_approval_change: create notification on status change ─────────
-- Watches BOTH the new `status` column and legacy `approval_status` column.
CREATE OR REPLACE FUNCTION public.on_profile_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_status text;
BEGIN
  -- Determine the effective status from whichever column changed
  v_effective_status := COALESCE(
    NULLIF(NEW.status, 'pending'),
    NULLIF(NEW.approval_status, 'pending'),
    NEW.status
  );

  IF v_effective_status IN ('approved', 'rejected')
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
     ) THEN
    INSERT INTO public.approval_notifications (user_id, approval_status)
    VALUES (NEW.id, v_effective_status);
  END IF;

  -- Keep both columns in sync
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected', 'pending') THEN
    NEW.approval_status := NEW.status;
  ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status AND NEW.approval_status IN ('approved', 'rejected', 'pending') THEN
    NEW.status := NEW.approval_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_approval_change_trigger ON public.profiles;
CREATE TRIGGER profile_approval_change_trigger
  BEFORE UPDATE OF status, approval_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_profile_approval_change();

-- ─── enforce_root_admin: ensure the root admin always has full privileges ─────
-- Updates ALL four auth columns: is_admin, approval_status, role, status.
CREATE OR REPLACE FUNCTION public.enforce_root_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.email, '')) = 'sriramparisa0x@gmail.com'
     AND lower(coalesce(NEW.username, '')) = 'buddy' THEN
    NEW.is_admin        := true;
    NEW.role            := 'admin';
    NEW.approval_status := 'approved';
    NEW.status          := 'approved';
  ELSE
    NEW.is_admin := false;
    -- Do NOT overwrite role/status for non-root users; admin approval manages those.
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_root_admin_trigger ON public.profiles;
CREATE TRIGGER enforce_root_admin_trigger
  BEFORE INSERT OR UPDATE OF email, username, is_admin, approval_status, role, status
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_root_admin();

-- (The is_admin and handle_new_user functions are defined once above.
--  No duplicate definitions needed.)
