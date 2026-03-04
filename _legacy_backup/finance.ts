import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const rawSmtpPort = process.env.SMTP_PORT;
const parsedSmtpPort = rawSmtpPort ? Number(rawSmtpPort) : undefined;
const SMTP_PORT = parsedSmtpPort && !Number.isNaN(parsedSmtpPort) ? parsedSmtpPort : undefined;
const SMTP_SECURE = process.env.SMTP_SECURE;
const NOTIFICATION_EMAIL = 'sriramparisa0x@proton.me';

// Supabase client (cached for Vercel hot instances)
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  }
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  return supabaseClient;
}

// Rate limiter
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, limit = 200, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count += 1;
  rateMap.set(ip, entry);
  return entry.count <= limit;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createMailer(): { transporter: nodemailer.Transporter; fromAddress: string } | null {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) return null;
  const parsedPort = SMTP_PORT && !Number.isNaN(SMTP_PORT) ? SMTP_PORT : 465;
  const secure = SMTP_SECURE === 'true' ? true : SMTP_SECURE === 'false' ? false : parsedPort === 465;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parsedPort,
    secure,
    auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
  });
  return { transporter, fromAddress: SMTP_EMAIL };
}

async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  const mailer = createMailer();
  if (!mailer) { console.warn("SMTP not configured, OTP:", otp); return false; }
  const { transporter, fromAddress } = mailer;
  try {
    await transporter.sendMail({
      from: `"FinanceBuddy" <${fromAddress}>`,
      to: email,
      subject: `Your FinanceBuddy Verification Code: ${otp}`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; color: #e2e8f0; border-radius: 16px;">
          <h2 style="color: #818cf8; margin-bottom: 8px;">FinanceBuddy</h2>
          <p style="margin-top: 0; color: #94a3b8;">Email Verification</p>
          <div style="background: #1e293b; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
            <p style="color: #94a3b8; margin-top: 0;">Your verification code is:</p>
            <h1 style="letter-spacing: 8px; color: #818cf8; font-size: 36px; margin: 16px 0;">${otp}</h1>
            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">This code expires in 10 minutes.</p>
          </div>
          <p style="color: #64748b; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('OTP Email error:', error);
    return false;
  }
}

async function sendApprovalEmail(newUser: any, host: string) {
  const mailer = createMailer();
  if (!mailer) return;
  const { transporter, fromAddress } = mailer;
  const approvalLink = `https://${host}/?tab=admin`;
  try {
    await transporter.sendMail({
      from: fromAddress,
      to: NOTIFICATION_EMAIL,
      subject: `New User Registration: ${newUser.display_name}`,
      html: `
        <h3>New Account Request</h3>
        <p><strong>Name:</strong> ${newUser.display_name}</p>
        <p><strong>Username:</strong> ${newUser.username}</p>
        <a href="${approvalLink}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Go to Admin Panel</a>
      `,
    });
  } catch (error) {
    console.error('Email error:', error);
  }
}

// Helper: Fetch a full user with all related data
async function fetchFullUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  if (!user) return null;

  const [txRes, debtRes, invRes, wishRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('debts').select('*').eq('user_id', userId),
    supabase.from('investments').select('*').eq('user_id', userId),
    supabase.from('wishlist').select('*').eq('user_id', userId),
  ]);

  return {
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    isApproved: user.is_approved,
    isAdmin: user.is_admin,
    creditScores: user.credit_scores || { cibil: 750, experian: 780 },
    transactions: (txRes.data || []).map((t: any) => ({
      id: t.id, amount: Number(t.amount), type: t.type, category: t.category, date: t.date, description: t.description,
    })),
    debts: (debtRes.data || []).map((d: any) => ({
      id: d.id, name: d.name, type: d.type, totalAmount: Number(d.total_amount), remainingAmount: Number(d.remaining_amount),
      interestRate: Number(d.interest_rate), monthlyEMI: Number(d.monthly_emi), dueDate: d.due_date, isPaused: d.is_paused,
    })),
    investments: (invRes.data || []).map((i: any) => ({
      id: i.id, name: i.name, type: i.type, investedAmount: Number(i.invested_amount),
      currentValue: Number(i.current_value), lastUpdated: i.last_updated,
    })),
    wishlist: (wishRes.data || []).map((w: any) => ({
      id: w.id, name: w.name, category: w.category, estimatedCost: Number(w.estimated_cost),
      priority: w.priority, status: w.status, viewCount: w.view_count,
    })),
  };
}

// Vercel Handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = getSupabase();
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Database configuration error', error: error.message });
  }

  const { method } = req;
  const query = req.query;
  const body = req.body;

  // Rate limit
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ success: false, message: 'Rate limit exceeded' });

  // ─── GET ───────────────────────────────────────────

  if (method === 'GET') {
    const { username, password, action } = query;

    // PING
    if (action === 'ping') {
      try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Supabase Connected', mode: 'cloud' });
      } catch (e: any) {
        return res.status(500).json({ success: false, message: 'Supabase Not Connected', error: e.message });
      }
    }

    // PENDING USERS
    if (action === 'pending_users') {
      const { data, error } = await supabase.from('users').select('username, display_name, email').eq('is_approved', false);
      if (error) return res.status(500).json({ success: false, error: 'Database error' });
      const mapped = (data || []).map((u: any) => ({ username: u.username, displayName: u.display_name, email: u.email }));
      return res.status(200).json({ success: true, data: mapped });
    }

    // LOGIN
    if (username && password) {
      try {
        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error || !user) return res.status(401).json({ success: false, message: 'User not found' });

        const valid = await bcrypt.compare(password as string, user.password);
        if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        if (!user.is_approved) return res.status(403).json({ success: false, message: 'Pending approval' });

        const token = jwt.sign({ username: user.username, isAdmin: !!user.is_admin }, process.env.JWT_SECRET || 'dev_jwt_secret', { expiresIn: '7d' });
        try {
          const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
          res.setHeader('Set-Cookie', `fb_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict${secureFlag}`);
        } catch (e) { /* ignore */ }

        const fullUser = await fetchFullUser(supabase, user.id);
        return res.status(200).json({ success: true, data: fullUser, token });
      } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
      }
    }

    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  // ─── POST ──────────────────────────────────────────

  if (method === 'POST') {
    const { username, data, action, password, displayName, email } = body;

    try {
      // Google OAuth
      if (action === 'google_oauth') {
        const { id_token } = body;
        if (!id_token) return res.status(400).json({ success: false, message: 'Missing id_token' });
        try {
          const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
          if (!verifyRes.ok) return res.status(401).json({ success: false, message: 'Invalid Google token' });
          const info = await verifyRes.json();
          const gEmail = info.email;
          const gName = info.name || info.email.split('@')[0];
          if (!gEmail) return res.status(400).json({ success: false, message: 'Google token did not include email' });

          let { data: user } = await supabase.from('users').select('*').eq('email', gEmail).single();
          if (!user) {
            const randomPass = Math.random().toString(36) + Date.now().toString(36);
            const hashed = await bcrypt.hash(randomPass, 10);
            const { data: newUser, error } = await supabase.from('users').insert({
              username: gEmail.split('@')[0],
              password: hashed,
              display_name: gName,
              email: gEmail,
              is_admin: false,
              is_approved: true,
              credit_scores: { cibil: 750, experian: 780 },
            }).select().single();
            if (error) return res.status(500).json({ success: false, message: 'Failed to create user' });
            user = newUser;
          }

          const token = jwt.sign({ username: user.username, isAdmin: !!user.is_admin }, process.env.JWT_SECRET || 'dev_jwt_secret', { expiresIn: '7d' });
          const fullUser = await fetchFullUser(supabase, user.id);
          return res.status(200).json({ success: true, data: fullUser, token });
        } catch (e: any) {
          return res.status(500).json({ success: false, message: 'OAuth verification failed' });
        }
      }

      // Create admin
      if (action === 'create_admin') {
        const { secret, newUsername, newPassword, newDisplayName, newEmail } = body;
        if (!process.env.ADMIN_CREATION_SECRET || secret !== process.env.ADMIN_CREATION_SECRET) {
          return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        const { data: existing } = await supabase.from('users').select('id').eq('username', newUsername).single();
        if (existing) return res.status(400).json({ success: false, message: 'Username already exists' });
        const hashed = await bcrypt.hash(newPassword, 10);
        const { data: admin, error } = await supabase.from('users').insert({
          username: newUsername, password: hashed, display_name: newDisplayName || 'Admin',
          email: newEmail || '', is_admin: true, is_approved: true,
          credit_scores: { cibil: 900, experian: 900 },
        }).select().single();
        if (error) return res.status(500).json({ success: false, message: 'Failed to create admin' });
        return res.status(200).json({ success: true, data: admin });
      }

      // Approve / Reject
      if (action === 'approve_user') {
        const { targetUsername, decision } = body;
        if (decision === 'reject') {
          await supabase.from('users').delete().eq('username', targetUsername);
          return res.status(200).json({ success: true, message: 'Rejected' });
        } else {
          await supabase.from('users').update({ is_approved: true }).eq('username', targetUsername);
          return res.status(200).json({ success: true, message: 'Approved' });
        }
      }

      // Register
      if (action === 'register') {
        const { data: existing } = await supabase.from('users').select('id').eq('username', username).single();
        if (existing) return res.status(400).json({ success: false, message: 'Username taken' });

        const { data: emailUser } = await supabase.from('users').select('id').eq('email', email).single();
        if (emailUser) return res.status(400).json({ success: false, message: 'Email already registered' });

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from('otp_challenges').upsert({
          email, otp, username, password, display_name: displayName || 'User', expires_at: expiresAt,
        }, { onConflict: 'email' });

        const emailSent = await sendOTPEmail(email, otp);
        if (!emailSent && SMTP_EMAIL) {
          return res.status(500).json({ success: false, message: 'Failed to send verification email.' });
        }
        return res.status(200).json({ success: true, message: 'OTP sent to your email', requiresOTP: true });
      }

      // Verify OTP
      if (action === 'verify_otp') {
        const { otp } = body;
        const { data: stored, error } = await supabase.from('otp_challenges').select('*').eq('email', email).single();
        if (error || !stored) return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });
        if (new Date(stored.expires_at) < new Date()) {
          await supabase.from('otp_challenges').delete().eq('email', email);
          return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
        }
        if (stored.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP. Try again.' });

        const hashed = await bcrypt.hash(stored.password, 10);
        const { data: newUser, error: insertError } = await supabase.from('users').insert({
          username: stored.username, password: hashed, email: stored.email,
          display_name: stored.display_name, is_approved: false, is_admin: false,
          credit_scores: { cibil: 750, experian: 780 },
        }).select().single();

        if (insertError) return res.status(500).json({ success: false, message: 'Failed to create user' });

        await supabase.from('otp_challenges').delete().eq('email', email);
        await sendApprovalEmail(newUser, req.headers.host || 'finance-buddy.vercel.app');
        return res.status(200).json({ success: true, data: newUser });
      }

      // Resend OTP
      if (action === 'resend_otp') {
        const { data: stored } = await supabase.from('otp_challenges').select('*').eq('email', email).single();
        if (!stored) return res.status(400).json({ success: false, message: 'No pending registration found.' });

        const newOtp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from('otp_challenges').update({ otp: newOtp, expires_at: expiresAt }).eq('email', email);

        await sendOTPEmail(email, newOtp);
        return res.status(200).json({ success: true, message: 'New OTP sent' });
      }

      // Sync Data
      if (username && data) {
        const { data: user, error: findError } = await supabase.from('users').select('id').eq('username', username).single();
        if (findError || !user) return res.status(404).json({ success: false, message: 'User not found' });
        const userId = user.id;

        // Update user-level fields
        const userUpdate: any = {};
        if (data.displayName !== undefined) userUpdate.display_name = data.displayName;
        if (data.creditScores !== undefined) userUpdate.credit_scores = data.creditScores;
        if (data.password !== undefined) userUpdate.password = await bcrypt.hash(data.password, 10);
        if (Object.keys(userUpdate).length > 0) await supabase.from('users').update(userUpdate).eq('id', userId);

        // Sync transactions
        if (data.transactions !== undefined) {
          await supabase.from('transactions').delete().eq('user_id', userId);
          if (data.transactions.length > 0) {
            const rows = data.transactions.map((t: any) => ({
              id: t.id, user_id: userId, amount: t.amount, type: t.type,
              category: t.category, date: t.date, description: t.description,
            }));
            await supabase.from('transactions').insert(rows);
          }
        }

        // Sync debts
        if (data.debts !== undefined) {
          await supabase.from('debts').delete().eq('user_id', userId);
          if (data.debts.length > 0) {
            const rows = data.debts.map((d: any) => ({
              id: d.id, user_id: userId, name: d.name, type: d.type,
              total_amount: d.totalAmount, remaining_amount: d.remainingAmount,
              interest_rate: d.interestRate, monthly_emi: d.monthlyEMI,
              due_date: d.dueDate, is_paused: d.isPaused,
            }));
            await supabase.from('debts').insert(rows);
          }
        }

        // Sync investments
        if (data.investments !== undefined) {
          await supabase.from('investments').delete().eq('user_id', userId);
          if (data.investments.length > 0) {
            const rows = data.investments.map((i: any) => ({
              id: i.id, user_id: userId, name: i.name, type: i.type,
              invested_amount: i.investedAmount, current_value: i.currentValue,
              last_updated: i.lastUpdated,
            }));
            await supabase.from('investments').insert(rows);
          }
        }

        // Sync wishlist
        if (data.wishlist !== undefined) {
          await supabase.from('wishlist').delete().eq('user_id', userId);
          if (data.wishlist.length > 0) {
            const rows = data.wishlist.map((w: any) => ({
              id: w.id, user_id: userId, name: w.name, category: w.category,
              estimated_cost: w.estimatedCost, priority: w.priority,
              status: w.status, view_count: w.viewCount,
            }));
            await supabase.from('wishlist').insert(rows);
          }
        }

        const fullUser = await fetchFullUser(supabase, userId);
        return res.status(200).json({ success: true, data: fullUser });
      }

    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  res.status(405).json({ error: `Method ${method} Not Allowed` });
}
