-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FIX_DATA.sql — Run this in Supabase SQL Editor to fix the auto-logout  ║
-- ║  Copy the ENTIRE file and execute it in a single run.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ═══ Step 1: Ensure columns exist ═══════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ═══ Step 2: Sync approval_status → status for ALL rows  ══════════════════
-- This is THE critical fix: if approval_status is 'approved' but status is
-- still 'pending' (DEFAULT), the app will instantly log you out.
UPDATE public.profiles
SET status = approval_status
WHERE approval_status IN ('approved', 'rejected')
  AND status = 'pending';

-- ═══ Step 3: Sync status → approval_status (reverse direction)  ════════════
UPDATE public.profiles
SET approval_status = status
WHERE status IN ('approved', 'rejected')
  AND approval_status = 'pending';

-- ═══ Step 4: Sync role ↔ is_admin  ════════════════════════════════════════
UPDATE public.profiles
SET role = 'admin'
WHERE is_admin = true AND role <> 'admin';

UPDATE public.profiles
SET is_admin = true
WHERE role = 'admin' AND is_admin = false;

-- ═══ Step 5: Ensure root admin is fully approved ══════════════════════════
UPDATE public.profiles
SET is_admin        = true,
    role            = 'admin',
    status          = 'approved',
    approval_status = 'approved',
    username        = 'buddy'
WHERE lower(email) = 'sriramparisa0x@gmail.com';

-- ═══ Step 6: Add constraints if missing  ══════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- ═══ Step 7: Recreate the is_admin function (checks both role + is_admin) ═
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

-- ═══ Step 8: Recreate handle_new_user (sets ALL 4 auth columns) ════════════
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

-- ═══ Step 9: Recreate enforce_root_admin (updates ALL 4 columns) ══════════
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_root_admin_trigger ON public.profiles;
CREATE TRIGGER enforce_root_admin_trigger
  BEFORE INSERT OR UPDATE OF email, username, is_admin, approval_status, role, status
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_root_admin();

-- ═══ Step 10: Recreate approval notification trigger (watches BOTH cols) ═══
CREATE OR REPLACE FUNCTION public.on_profile_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_status text;
BEGIN
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

-- ═══ Step 11: Fix RLS policy for profile updates ══════════════════════════
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

-- ═══ Verification: show current profile data ══════════════════════════════
SELECT id, name, username, email, role, status, approval_status, is_admin
FROM public.profiles
ORDER BY created_at;
