# FinanceBuddy — Supabase Configuration Guide

## 1. Run ALL SQL Migration Files (IN ORDER)

Go to **Supabase Dashboard → SQL Editor** and run each file listed below, one by one, in order:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/001_profiles.sql` | Profiles table, status/role columns |
| 2 | `supabase/migrations/002_transactions.sql` | Transactions table |
| 3 | `supabase/migrations/003_debts.sql` | Debts table |
| 4 | `supabase/migrations/004_investments.sql` | Investments table |
| 5 | `supabase/migrations/005_credit_scores.sql` | Credit scores table |
| 6 | `supabase/migrations/006_wishlist.sql` | Wishlist table |
| 7 | `supabase/migrations/007_rls_policies.sql` | **ALL RLS policies** (including admin update policy) |
| 8 | `supabase/migrations/008_functions.sql` | **ALL functions** (is_admin, get_login_email, handle_new_user, etc.) |

> **CRITICAL**: File `007_rls_policies.sql` and `008_functions.sql` are essential for approve/reject buttons to work. The `is_admin()` function is used by RLS policies to allow admins to update other users' profiles.

If you've already run some of them, the scripts use `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, and `DROP POLICY IF EXISTS` so they're safe to re-run.

---

## 2. Enable Email OTP in Supabase Auth Settings

Go to **Supabase Dashboard → Authentication → Providers → Email**:

1. **Enable Email provider** — should already be ON
2. **Enable "Magic Link"** — set to **ON** (this enables `signInWithOtp`)
3. **OTP Expiry** — recommend 600 seconds (10 minutes)
4. **Minimum OTP length** — set to **6**

### Email Confirmation Setting

Go to **Authentication → Settings**:

- Set **"Confirm email"** to your preference:
  - If **ON**: Supabase also sends its own confirmation email on signup (in addition to our OTP). Can be left ON.
  - If **OFF**: Only our app's OTP flow handles email verification. Simpler UX.
  - **Recommended: OFF** (we handle verification ourselves)

---

## 3. Email Delivery (SMTP) Configuration

For OTP emails to actually reach users, configure SMTP:

Go to **Project Settings → Auth → SMTP Settings**:

### Option A: Use Supabase's Built-in Email (Development Only)
- No SMTP config needed
- **Rate limited**: 3 emails/hour (per Supabase free tier)
- Fine for testing, NOT for production

### Option B: Configure Custom SMTP (Production)
Use any email provider (Gmail, SendGrid, Resend, Mailgun, etc.):

**Example with Gmail App Password:**
| Setting | Value |
|---------|-------|
| SMTP Host | `smtp.gmail.com` |
| SMTP Port | `465` |
| SMTP User | `your-email@gmail.com` |
| SMTP Pass | (Gmail App Password — NOT your regular password) |
| Sender email | `your-email@gmail.com` |
| Sender name | `FinanceBuddy` |

**Example with Resend (recommended for production):**
| Setting | Value |
|---------|-------|
| SMTP Host | `smtp.resend.com` |
| SMTP Port | `465` |
| SMTP User | `resend` |
| SMTP Pass | (your Resend API key) |
| Sender email | `noreply@yourdomain.com` |
| Sender name | `FinanceBuddy` |

---

## 4. Customize Email Templates (Optional)

Go to **Authentication → Email Templates**:

### Magic Link / OTP Template
This template is used for the login OTP. Customize the "Magic Link" template:

```html
<h2>FinanceBuddy Verification Code</h2>
<p>Your verification code is:</p>
<h1 style="font-size: 32px; letter-spacing: 8px; text-align: center; padding: 16px; background: #f1f5f9; border-radius: 8px;">{{ .Token }}</h1>
<p>This code expires in 10 minutes.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

### Confirm Signup Template (if "Confirm email" is ON)
Similar template for the signup confirmation email.

---

## 5. Auth Settings Checklist

Go to **Authentication → URL Configuration**:

| Setting | Value |
|---------|-------|
| Site URL | Your app's URL (e.g., `https://your-app.vercel.app` or `http://localhost:5173`) |
| Redirect URLs | Add `http://localhost:5173`, `https://your-app.vercel.app` |

Go to **Authentication → Settings**:

| Setting | Recommended |
|---------|-------------|
| Enable email confirmations | OFF (we handle it via OTP) |
| Enable email signup | ON |
| Disable email login | OFF (keep enabled) |
| Minimum password length | 8 |
| JWT Expiry | 3600 (1 hour, default) |

---

## 6. Verify the Root Admin Account

The `handle_new_user` trigger in `008_functions.sql` automatically sets `sriramparisa0x@gmail.com` as admin with status `approved`.

To verify, go to **Table Editor → profiles** and confirm:
- Email: `sriramparisa0x@gmail.com`
- Role: `admin`
- Status: `approved`
- is_admin: `true`

If the profile exists but has wrong values, run:
```sql
UPDATE public.profiles
SET role = 'admin', status = 'approved', approval_status = 'approved', is_admin = true
WHERE lower(email) = 'sriramparisa0x@gmail.com';
```

---

## 7. Verify RLS Functions Are Working

Run this in SQL Editor to test:
```sql
-- Check if is_admin function exists
SELECT public.is_admin('00000000-0000-0000-0000-000000000000'::uuid);
-- Should return FALSE (no user with that ID)

-- Check the admin user's ID
SELECT id, email, role, status, is_admin FROM public.profiles WHERE lower(email) = 'sriramparisa0x@gmail.com';

-- Test is_admin with the actual admin UUID
-- Replace <ADMIN_UUID> with the id from the query above
-- SELECT public.is_admin('<ADMIN_UUID>'::uuid);
-- Should return TRUE
```

---

## Summary of What Each Feature Needs

| Feature | Requires |
|---------|----------|
| Login | Email provider ON, Magic Link ON |
| Registration | Email provider ON, `handle_new_user` trigger |
| OTP verification | Magic Link ON, SMTP configured (or use built-in) |
| Admin approve/reject | `is_admin()` function + RLS policies from 007 + 008 |
| Session stability | Default JWT settings (3600s expiry) |
| Password reset | Magic Link ON |
