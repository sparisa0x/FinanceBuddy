# Clerk + Supabase Migration Setup Guide

This document describes how to complete the migration from Supabase Auth to Clerk Authentication.

---

## Architecture Overview

| Layer          | Technology          |
| -------------- | ------------------- |
| Frontend       | React + Vite        |
| Authentication | Clerk               |
| Database       | Supabase PostgreSQL |
| Hosting        | Vercel              |

Clerk handles **all authentication** (registration, login, email OTP, session management).
Supabase is used **only as the PostgreSQL database** — `auth.users` is no longer referenced.

---

## Step 1 — Clerk Dashboard Setup

### 1.1 Create a Clerk Application

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com) and create a new application.
2. Under **User & Authentication → Email, phone, username**, enable:
   - **Email address** (required)
   - **Username** (required)
   - **Password** (required)
3. Under **Email, phone, username → Email address**, ensure:
   - **Verify at sign-up** is enabled (this triggers the email OTP code during registration)
4. Under **Multi-factor**, optionally enable **Email code** if you want mandatory OTP on every login.

### 1.2 Get Your Publishable Key

1. Go to **API Keys** in the Clerk Dashboard.
2. Select **React** as the framework.
3. Copy the **Publishable Key** (starts with `pk_test_` or `pk_live_`).

### 1.3 Create a Supabase JWT Template

This is **critical** — it allows the frontend to make authenticated Supabase requests using Clerk tokens.

1. In Clerk Dashboard, go to **JWT Templates**.
2. Click **New template** → select **Supabase**.
3. Configure:
   - **Name**: `supabase`
   - **Signing algorithm**: `HS256`
   - **Signing key**: Your Supabase **JWT Secret** (find it in Supabase Dashboard → Settings → API → JWT Secret)
4. Set the **Claims** to:

   ```json
   {
     "sub": "{{user.id}}",
     "aud": "authenticated",
     "role": "authenticated",
     "email": "{{user.primary_email_address}}",
     "iss": "https://{{env.CLERK_DOMAIN}}"
   }
   ```

5. Save the template.

---

## Step 2 — Environment Variables

### 2.1 Local Development

Create a `.env.local` file in the project root:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2.2 Vercel Deployment

Add the same variables in your Vercel project settings:

- **Settings → Environment Variables**
- Add `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Step 3 — Database Migration

### 3.1 Backup Your Database

Before running the migration, create a backup:

- In Supabase Dashboard → **Database → Backups** → Download a backup.

### 3.2 Run the Migration

Open the Supabase SQL Editor and execute the contents of:

```text
supabase/migrations/009_clerk_migration.sql
```

This script:

1. Drops the `on_auth_user_created` trigger (no longer needed)
2. Drops `otp_challenges` and `user_sessions` tables (Clerk handles these)
3. Removes the foreign key from `profiles.id` to `auth.users(id)`
4. Changes `profiles.id` and all `user_id` columns from UUID to TEXT
5. Re-adds foreign key constraints with `ON UPDATE CASCADE`
6. Drops legacy columns (`approval_status`, `is_admin`)
7. Creates new RLS policies using `public.clerk_uid()` (reads Clerk JWT `sub` claim)
8. Updates helper functions (`is_admin`, `pay_debt_emi`, etc.) for TEXT-based IDs

### 3.3 Verify Migration

After running, verify in the SQL Editor:

```sql
-- Check profiles table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

---

## Step 4 — Set Up Admin Account

After migration, the root admin profile keeping its `role = 'admin'` and `status = 'approved'`.

For the admin to use Clerk:

1. Register a new Clerk account with the admin email (`sriramparisa0x@gmail.com`)
2. After Clerk registration, the app creates a NEW profile with the Clerk user ID
3. Manually update the profile in Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin', status = 'approved'
WHERE email = 'sriramparisa0x@gmail.com'
  AND id LIKE 'user_%';  -- Clerk IDs start with 'user_'
```

Or if you want to link the new Clerk user to the existing admin profile's data, you'll need to update the old profile's `id` to the new Clerk user ID:

```sql
-- Replace NEW_CLERK_USER_ID with the actual Clerk user ID
UPDATE public.profiles
SET id = 'NEW_CLERK_USER_ID'
WHERE email = 'sriramparisa0x@gmail.com';
```

Because of `ON UPDATE CASCADE`, all related data (transactions, debts, etc.) will automatically update.

---

## Step 5 — Existing User Migration

Existing users have UUID-based profile IDs from Supabase Auth. When they re-register with Clerk:

1. They register with Clerk using their **same email**.
2. After email verification, a new Supabase profile is created with their **Clerk user ID**.
3. Their old data (linked to the UUID-based profile) can be migrated:

```sql
-- Replace OLD_UUID and NEW_CLERK_ID with actual values
UPDATE public.profiles
SET id = 'NEW_CLERK_ID'
WHERE id = 'OLD_UUID';
-- CASCADE updates all related tables automatically
```

For a self-service migration, you could later build an "account linking" feature in the admin panel.

---

## Authentication Flow Summary

### Registration

1. User fills: Full Name, Email, Username, Password, Confirm Password
2. Clerk creates the user account
3. Email OTP code is sent (Clerk's built-in email verification)
4. User enters the 6-digit code
5. A Supabase profile is created with `status: 'pending'`
6. User is signed out and shown "Awaiting admin approval"
7. Admin approves in the Admin Panel
8. User can now sign in

### Login

1. User enters Username/Email + Password
2. Clerk verifies credentials
3. Session is created by Clerk (persistent, no more session instability)
4. App checks Supabase profile status:
   - `approved` → Dashboard loads
   - `pending` → "Awaiting approval" screen with sign-out option
   - `rejected` → "Registration rejected" screen with sign-out option

### Session Persistence

- Clerk manages sessions automatically (token refresh, persistence across tabs)
- No more manual inactivity timers or `onAuthStateChange` listeners
- Sessions persist across page refreshes reliably

---

## What Changed (File Summary)

| File | Change |
| --- | --- |
| `index.tsx` | Wrapped app in `<ClerkProvider>` |
| `lib/supabase.ts` | Added `createClerkSupabaseClient()` that injects Clerk JWT |
| `context/FinanceContext.tsx` | **Major rewrite**: removed all Supabase Auth code, uses Clerk `useUser()`/`useAuth()`, simplified auth state machine |
| `components/Login.tsx` | **Rewritten**: uses Clerk `useSignIn()`/`useSignUp()` hooks for custom forms |
| `components/Layout.tsx` | Uses Clerk `signOut()` instead of Supabase `auth.signOut()` |
| `components/Profile.tsx` | Removed password change form, links to Clerk User Profile |
| `components/AdminPanel.tsx` | Uses Clerk-authenticated Supabase client |
| `App.tsx` | Added pending/rejected profile status screens |
| `supabase/migrations/009_clerk_migration.sql` | Full database migration script |
| `.env.local.example` | Template for required environment variables |

### Backup Files

The following `.bak` files are kept for reference:

- `context/FinanceContext.tsx.bak` — original Supabase Auth context
- `components/Login.tsx.bak` — original login component
- `components/Profile.tsx.bak` — original profile with password change

These can be safely deleted once the migration is verified.

---

## Troubleshooting

### "Invalid JWT" errors from Supabase

- Ensure the Clerk JWT template is named exactly `supabase`
- Verify the signing key matches your Supabase JWT Secret
- Check that the JWT claims include `aud: "authenticated"` and `role: "authenticated"`

### Profile not found after Clerk login

- The `ensureProfile` function is called after sign-up email verification
- If a user signs in before creating a profile, they'll see "pending approval" screen
- Manually create the profile in Supabase SQL Editor if needed
- If the same email or username already exists from a legacy profile, run `supabase/ADD_BYPASS_FUNCTIONS.sql` so the existing row is migrated to the Clerk user ID instead of failing on the unique email or username index

### Admin can't see pending users

- Ensure the admin profile has `role = 'admin'` and `status = 'approved'`
- The `is_clerk_admin()` RLS function checks `role = 'admin'` in the profiles table

### RLS errors

- Ensure the Clerk JWT template is configured correctly
- The `clerk_uid()` function reads `request.jwt.claim.sub` — this must contain the Clerk user ID
- Test with: `SELECT public.clerk_uid();` in the SQL Editor (will return NULL outside of a JWT context)
