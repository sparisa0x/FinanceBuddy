-- 001_profiles.sql
-- Purpose: Create and evolve profile-centric/auth-support tables and profile data defaults.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- profiles (linked 1-to-1 with auth.users)
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

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique ON public.profiles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

-- auth hardening support tables (kept with profile/auth domain)
CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text,
  purpose       text NOT NULL CHECK (purpose IN ('login', 'signup', 'password_reset', 'admin_login', 'admin_register')),
  code_hash     text NOT NULL,
  attempts      int NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  session_label      text,
  ip                 text,
  user_agent         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_active_at     timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '5 days'),
  revoked_at         timestamptz
);

CREATE TABLE IF NOT EXISTS public.approval_notifications (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_status text NOT NULL CHECK (approval_status IN ('approved', 'rejected')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  is_read         boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_id ON public.otp_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_email ON public.otp_challenges(lower(email));
CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires_at ON public.otp_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_approval_notifications_user_id ON public.approval_notifications(user_id);

-- Backfill: ensure every auth.users row has a matching profiles row.
-- Covers users created before the trigger existed or when a prior partial
-- schema run prevented the trigger from firing.
INSERT INTO public.profiles (id, name, username, email, approval_status, is_admin)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE(
    NULLIF(lower(u.raw_user_meta_data->>'username'), ''),
    lower(split_part(u.email, '@', 1))
  ),
  u.email,
  CASE WHEN lower(u.email) = 'sriramparisa0x@gmail.com' THEN 'approved' ELSE 'pending' END,
  CASE WHEN lower(u.email) = 'sriramparisa0x@gmail.com' THEN true      ELSE false     END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO UPDATE
  SET name  = EXCLUDED.name,
      email = EXCLUDED.email;

-- default single admin
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

UPDATE public.profiles
SET role = CASE WHEN coalesce(is_admin, false) THEN 'admin' ELSE 'user' END
WHERE role IS NULL OR role NOT IN ('user', 'admin');

UPDATE public.profiles
SET status = CASE
  WHEN approval_status IN ('pending', 'approved', 'rejected') THEN approval_status
  ELSE 'pending'
END
WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected');

UPDATE public.profiles
SET role = 'admin', status = 'approved'
WHERE lower(coalesce(email, '')) = 'sriramparisa0x@gmail.com'
  AND lower(coalesce(username, '')) = 'buddy';
