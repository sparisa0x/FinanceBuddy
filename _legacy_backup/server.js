import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase client
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY is missing in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

// OTP Helper
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createMailer() {
  const SMTP_EMAIL = process.env.SMTP_EMAIL;
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    return null;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const rawPort = process.env.SMTP_PORT;
  const parsedPort = rawPort ? Number(rawPort) : 465;
  const port = Number.isNaN(parsedPort) ? 465 : parsedPort;
  const secure = process.env.SMTP_SECURE === 'true' ? true : process.env.SMTP_SECURE === 'false' ? false : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
  });

  return { transporter, fromAddress: SMTP_EMAIL };
}

async function sendOTPEmail(email, otp) {
  const mailer = createMailer();
  if (!mailer) {
    console.warn("SMTP not configured, OTP:", otp);
    return false;
  }

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

async function sendApprovalEmail(newUser, host) {
  const NOTIFICATION_EMAIL = 'sriramparisa0x@proton.me';
  const mailer = createMailer();
  if (!mailer) return;
  const { transporter, fromAddress } = mailer;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: NOTIFICATION_EMAIL,
      subject: `New User Registration: ${newUser.display_name}`,
      html: `
        <h3>New Account Request</h3>
        <p><strong>Name:</strong> ${newUser.display_name}</p>
        <p><strong>Username:</strong> ${newUser.username}</p>
        <a href="http://${host}/?tab=admin">Go to Admin Panel</a>
      `,
    });
    console.log('Approval email sent');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Helper: Fetch a full user with all related data
async function fetchFullUser(userId) {
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
    transactions: (txRes.data || []).map(t => ({
      id: t.id, amount: Number(t.amount), type: t.type, category: t.category, date: t.date, description: t.description,
    })),
    debts: (debtRes.data || []).map(d => ({
      id: d.id, name: d.name, type: d.type, totalAmount: Number(d.total_amount), remainingAmount: Number(d.remaining_amount),
      interestRate: Number(d.interest_rate), monthlyEMI: Number(d.monthly_emi), dueDate: d.due_date, isPaused: d.is_paused,
    })),
    investments: (invRes.data || []).map(i => ({
      id: i.id, name: i.name, type: i.type, investedAmount: Number(i.invested_amount),
      currentValue: Number(i.current_value), lastUpdated: i.last_updated,
    })),
    wishlist: (wishRes.data || []).map(w => ({
      id: w.id, name: w.name, category: w.category, estimatedCost: Number(w.estimated_cost),
      priority: w.priority, status: w.status, viewCount: w.view_count,
    })),
  };
}

// ─── API Routes ────────────────────────────────────────────────

// Health Check / Ping + Login
app.get('/api/finance', async (req, res) => {
  const { action, username, password } = req.query;

  // PING
  if (action === 'ping') {
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Supabase Connected', mode: 'cloud' });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Supabase Not Connected', error: e.message });
    }
  }

  // PENDING USERS (Admin)
  if (action === 'pending_users') {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, display_name, email')
        .eq('is_approved', false);
      if (error) throw error;
      const mapped = (data || []).map(u => ({ username: u.username, displayName: u.display_name, email: u.email }));
      return res.status(200).json({ success: true, data: mapped });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  // LOGIN
  if (username && password) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !user) return res.status(401).json({ success: false, message: 'User not found' });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      if (!user.is_approved) return res.status(403).json({ success: false, message: 'Account pending approval.' });

      // Issue JWT
      const token = jwt.sign(
        { username: user.username, isAdmin: !!user.is_admin },
        process.env.JWT_SECRET || 'dev_jwt_secret',
        { expiresIn: '7d' }
      );
      const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie', `fb_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict${secureFlag}`);

      const fullUser = await fetchFullUser(user.id);
      return res.status(200).json({ success: true, data: fullUser, token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  res.status(400).json({ success: false, message: "Invalid Request" });
});

// POST Requests (Register, Update, Approve)
app.post('/api/finance', async (req, res) => {
  const { username, data, action, password, displayName, email } = req.body;

  try {
    // APPROVE / REJECT
    if (action === 'approve_user') {
      const { targetUsername, decision } = req.body;
      if (decision === 'reject') {
        await supabase.from('users').delete().eq('username', targetUsername);
        return res.status(200).json({ success: true, message: 'User rejected' });
      } else {
        await supabase.from('users').update({ is_approved: true }).eq('username', targetUsername);
        return res.status(200).json({ success: true, message: 'User approved' });
      }
    }

    // REGISTER - Step 1: Send OTP
    if (action === 'register') {
      const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).single();
      if (existingUser) return res.status(400).json({ success: false, message: 'Username taken' });

      const { data: emailUser } = await supabase.from('users').select('id').eq('email', email).single();
      if (emailUser) return res.status(400).json({ success: false, message: 'Email already registered' });

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Upsert OTP challenge (replace if email already has pending OTP)
      await supabase.from('otp_challenges').upsert({
        email,
        otp,
        username,
        password,
        display_name: displayName || 'User',
        expires_at: expiresAt,
      }, { onConflict: 'email' });

      const emailSent = await sendOTPEmail(email, otp);
      if (!emailSent && process.env.SMTP_EMAIL) {
        return res.status(500).json({ success: false, message: 'Failed to send verification email. Try again.' });
      }

      return res.status(200).json({ success: true, message: 'OTP sent to your email', requiresOTP: true });
    }

    // REGISTER - Step 2: Verify OTP
    if (action === 'verify_otp') {
      const { otp } = req.body;
      const { data: stored, error } = await supabase
        .from('otp_challenges')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !stored) return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });
      if (new Date(stored.expires_at) < new Date()) {
        await supabase.from('otp_challenges').delete().eq('email', email);
        return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
      }
      if (stored.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP. Try again.' });

      // OTP verified — hash password & create user
      const hashed = await bcrypt.hash(stored.password, 10);
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          username: stored.username,
          password: hashed,
          email: stored.email,
          display_name: stored.display_name,
          is_approved: false,
          is_admin: false,
          credit_scores: { cibil: 750, experian: 780 },
        })
        .select()
        .single();

      if (insertError) {
        console.error('User insert error:', insertError);
        return res.status(500).json({ success: false, message: 'Failed to create user' });
      }

      await supabase.from('otp_challenges').delete().eq('email', email);
      await sendApprovalEmail(newUser, req.headers.host);

      return res.status(200).json({
        success: true,
        data: {
          username: newUser.username,
          displayName: newUser.display_name,
          email: newUser.email,
          isApproved: newUser.is_approved,
          isAdmin: newUser.is_admin,
        },
      });
    }

    // RESEND OTP
    if (action === 'resend_otp') {
      const { data: stored } = await supabase.from('otp_challenges').select('*').eq('email', email).single();
      if (!stored) return res.status(400).json({ success: false, message: 'No pending registration found.' });

      const newOtp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from('otp_challenges').update({ otp: newOtp, expires_at: expiresAt }).eq('email', email);

      await sendOTPEmail(email, newOtp);
      return res.status(200).json({ success: true, message: 'New OTP sent to your email' });
    }

    // SYNC DATA
    if (username && data) {
      // Find user
      const { data: user, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (findError || !user) return res.status(404).json({ success: false, message: 'User not found' });
      const userId = user.id;

      // Update user-level fields
      const userUpdate = {};
      if (data.displayName !== undefined) userUpdate.display_name = data.displayName;
      if (data.creditScores !== undefined) userUpdate.credit_scores = data.creditScores;
      if (data.password !== undefined) {
        const hashed = await bcrypt.hash(data.password, 10);
        userUpdate.password = hashed;
      }
      if (Object.keys(userUpdate).length > 0) {
        await supabase.from('users').update(userUpdate).eq('id', userId);
      }

      // Sync transactions (replace all)
      if (data.transactions !== undefined) {
        await supabase.from('transactions').delete().eq('user_id', userId);
        if (data.transactions.length > 0) {
          const rows = data.transactions.map(t => ({
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
          const rows = data.debts.map(d => ({
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
          const rows = data.investments.map(i => ({
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
          const rows = data.wishlist.map(w => ({
            id: w.id, user_id: userId, name: w.name, category: w.category,
            estimated_cost: w.estimatedCost, priority: w.priority,
            status: w.status, view_count: w.viewCount,
          }));
          await supabase.from('wishlist').insert(rows);
        }
      }

      // Return full user data
      const fullUser = await fetchFullUser(userId);
      return res.status(200).json({ success: true, data: fullUser });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Backend Server running on http://localhost:${PORT}`);
  console.log(`➜  API Endpoint: http://localhost:${PORT}/api/finance`);
  console.log(`➜  Database: Supabase (${SUPABASE_URL})`);
});
