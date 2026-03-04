import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const SMTP_EMAIL = process.env.SMTP_EMAIL; 
const SMTP_PASSWORD = process.env.SMTP_PASSWORD; 
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const rawSmtpPort = process.env.SMTP_PORT;
const parsedSmtpPort = rawSmtpPort ? Number(rawSmtpPort) : undefined;
const SMTP_PORT = parsedSmtpPort && !Number.isNaN(parsedSmtpPort) ? parsedSmtpPort : undefined;
const SMTP_SECURE = process.env.SMTP_SECURE;
const NOTIFICATION_EMAIL = 'sriramparisa0x@proton.me'; 

// Caching the connection for Vercel "Hot" instances
let cached = (globalThis as any).mongoose;

if (!cached) {
  cached = (globalThis as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in Vercel Environment Variables');
  }
  
  if (cached.conn) {
    // console.log("Using cached MongoDB connection");
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Fail fast if network is down
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("New MongoDB connection established");
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Schema Definition
const UserDataSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String, default: 'User' },
  email: { type: String }, 
  isApproved: { type: Boolean, default: false }, 
  isAdmin: { type: Boolean, default: false }, 
  transactions: [{
    id: String,
    amount: Number,
    type: String,
    category: String,
    date: String,
    description: String
  }],
  debts: [{
    id: String,
    name: String,
    type: String,
    totalAmount: Number,
    remainingAmount: Number,
    interestRate: Number,
    monthlyEMI: Number,
    dueDate: Number,
    isPaused: Boolean
  }],
  investments: [{
    id: String,
    name: String,
    type: String,
    investedAmount: Number,
    currentValue: Number,
    lastUpdated: String
  }],
  wishlist: [{
    id: String,
    name: String,
    category: String,
    estimatedCost: Number,
    priority: String,
    status: String,
    viewCount: Number
  }],
  creditScores: {
    cibil: Number,
    experian: Number
  }
}, { minimize: false });

// Prevent model recompilation error in serverless environment
const UserData: any = mongoose.models.UserData || mongoose.model('UserData', UserDataSchema);

// OTP Store: prefer Redis when `REDIS_URL` is provided, otherwise in-memory Map
const REDIS_URL = process.env.REDIS_URL;
const redisClient = REDIS_URL ? new Redis(REDIS_URL) : null;

const otpStore = new Map(); // fallback

async function setOTP(email: string, payload: any) {
  if (redisClient) {
    await redisClient.set(`otp:${email}`, JSON.stringify(payload), 'EX', 10 * 60);
  } else {
    otpStore.set(email, payload);
  }
}

async function getOTP(email: string) {
  if (redisClient) {
    const v = await redisClient.get(`otp:${email}`);
    return v ? JSON.parse(v) : null;
  }
  return otpStore.get(email);
}

async function delOTP(email: string) {
  if (redisClient) {
    await redisClient.del(`otp:${email}`);
  } else {
    otpStore.delete(email);
  }
}

// Basic in-memory rate limiter per IP (lightweight)
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, limit = 200, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0; entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  rateMap.set(ip, entry);
  return entry.count <= limit;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createMailer(): { transporter: nodemailer.Transporter; fromAddress: string } | null {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    return null;
  }

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

async function sendApprovalEmail(newUser: any, host: string) {
  const mailer = createMailer();
  if (!mailer) return;

  const { transporter, fromAddress } = mailer;

  const approvalLink = `https://${host}/?tab=admin`; 

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: NOTIFICATION_EMAIL,
      subject: `New User Registration: ${newUser.displayName}`,
      html: `
        <h3>New Account Request</h3>
        <p><strong>Name:</strong> ${newUser.displayName}</p>
        <p><strong>Username:</strong> ${newUser.username}</p>
        <a href="${approvalLink}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Go to Admin Panel</a>
      `,
    });
  } catch (error) {
    console.error('Email error:', error);
  }
}

// Vercel Handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectToDatabase();
  } catch (error: any) {
    console.error("DB Connect Error:", error);
    return res.status(500).json({ success: false, message: 'Database connection failed', error: error.message });
  }

  const { method } = req;
  const query = req.query;
  const body = req.body;

  // HEALTH CHECK
  if (method === 'GET' && query.action === 'ping') {
    return res.status(200).json({ success: true, message: 'MongoDB Connected', mode: 'cloud' });
  }
  
  // LOGIN & FETCH
  if (method === 'GET') {
    const { username, password, action } = query;
    let user: any;

    // Rate limit by IP
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) return res.status(429).json({ success: false, message: 'Rate limit exceeded' });

    if (action === 'pending_users') {
      const pendingUsers = await UserData.find({ isApproved: false }, 'username displayName email');
      return res.status(200).json({ success: true, data: pendingUsers });
    }

    try {
      if (!user) {
        user = await UserData.findOne({ username });
      }
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });

      // Compare hashed password
      const valid = await bcrypt.compare(password as string, user.password);
      if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      if (!user.isApproved) return res.status(403).json({ success: false, message: 'Pending approval' });

      // Issue JWT
      const token = jwt.sign({ username: user.username, isAdmin: !!user.isAdmin }, process.env.JWT_SECRET || 'dev_jwt_secret', { expiresIn: '7d' });
      // Set httpOnly cookie (optional)
      try {
        const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
        res.setHeader('Set-Cookie', `fb_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict${secureFlag}`);
      } catch (e) { /* ignore cookie set errors */ }

      return res.status(200).json({ success: true, data: user, token });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST ACTIONS
  if (method === 'POST') {
    const { username, data, action, password, displayName, email } = body;

    try {
      // Google OAuth sign-in (client sends `id_token` from Google)
      if (action === 'google_oauth') {
        const { id_token } = body;
        if (!id_token) return res.status(400).json({ success: false, message: 'Missing id_token' });
        // Verify token with Google
        try {
          const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
          if (!verifyRes.ok) return res.status(401).json({ success: false, message: 'Invalid Google token' });
          const info = await verifyRes.json();
          const email = info.email;
          const name = info.name || info.email.split('@')[0];
          if (!email) return res.status(400).json({ success: false, message: 'Google token did not include email' });

          // Upsert user by email
          let user = await UserData.findOne({ email });
          if (!user) {
            const randomPass = Math.random().toString(36) + Date.now().toString(36);
            const hashed = await bcrypt.hash(randomPass, 10);
            user = await UserData.create({ username: email.split('@')[0], password: hashed, displayName: name, email, isAdmin: false, isApproved: true, transactions: [], debts: [], investments: [], wishlist: [], creditScores: { cibil: 750, experian: 780 } });
          }

          const token = jwt.sign({ username: user.username, isAdmin: !!user.isAdmin }, process.env.JWT_SECRET || 'dev_jwt_secret', { expiresIn: '7d' });
          return res.status(200).json({ success: true, data: user, token });
        } catch (e: any) {
          console.error('Google verify error', e);
          return res.status(500).json({ success: false, message: 'OAuth verification failed' });
        }
      }

      // Create admin (protected)
      if (action === 'create_admin') {
         const { secret, newUsername, newPassword, newDisplayName, newEmail } = body;
         if (!process.env.ADMIN_CREATION_SECRET || secret !== process.env.ADMIN_CREATION_SECRET) {
           return res.status(403).json({ success: false, message: 'Forbidden' });
         }
         const existing = await UserData.findOne({ username: newUsername });
         if (existing) return res.status(400).json({ success: false, message: 'Username already exists' });
         const hashed = await bcrypt.hash(newPassword, 10);
         const admin = await UserData.create({ username: newUsername, password: hashed, displayName: newDisplayName || 'Admin', email: newEmail || '', isAdmin: true, isApproved: true, transactions: [], debts: [], investments: [], wishlist: [], creditScores: { cibil: 900, experian: 900 } });
         return res.status(200).json({ success: true, data: admin });
      }

      if (action === 'approve_user') {
         const { targetUsername, decision } = body;
         if (decision === 'reject') {
            await UserData.deleteOne({ username: targetUsername });
            return res.status(200).json({ success: true, message: 'Rejected' });
         } else {
            await UserData.findOneAndUpdate({ username: targetUsername }, { isApproved: true });
            return res.status(200).json({ success: true, message: 'Approved' });
         }
      }

      if (action === 'register') {
        const existing = await UserData.findOne({ username });
        if (existing) return res.status(400).json({ success: false, message: 'Username taken' });

        const emailExists = await UserData.findOne({ email });
        if (emailExists) return res.status(400).json({ success: false, message: 'Email already registered' });

        const otp = generateOTP();
        await setOTP(email, { otp, username, password, displayName: displayName || 'User', email, createdAt: Date.now() });
        const emailSent = await sendOTPEmail(email, otp);
        if (!emailSent && SMTP_EMAIL) {
          return res.status(500).json({ success: false, message: 'Failed to send verification email.' });
        }
        return res.status(200).json({ success: true, message: 'OTP sent to your email', requiresOTP: true });
      }

      if (action === 'verify_otp') {
        const { otp } = body;
        const stored = await getOTP(email);

        if (!stored) return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });
        // Redis TTL handles expiry; for in-memory fallback check createdAt
        if (!redisClient && Date.now() - (stored.createdAt || 0) > 10 * 60 * 1000) {
          await delOTP(email);
          return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
        }
        if (stored.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP. Try again.' });

        // Hash the password before storing
        const hashed = await bcrypt.hash(stored.password, 10);
        const newUser = await UserData.create({
          username: stored.username, password: hashed, email: stored.email,
          displayName: stored.displayName,
          isApproved: false, isAdmin: false,
          transactions: [], debts: [], investments: [], wishlist: [],
          creditScores: { cibil: 750, experian: 780 }
        });

        await delOTP(email);
        await sendApprovalEmail(newUser, req.headers.host || 'finance-buddy.vercel.app');
        return res.status(200).json({ success: true, data: newUser });
      }

      if (action === 'resend_otp') {
        const stored = await getOTP(email);
        if (!stored) return res.status(400).json({ success: false, message: 'No pending registration found.' });

        const newOtp = generateOTP();
        stored.otp = newOtp; stored.createdAt = Date.now();
        await setOTP(email, stored);

        await sendOTPEmail(email, newOtp);
        return res.status(200).json({ success: true, message: 'New OTP sent' });
      }

      // Sync Data
      const user = await UserData.findOneAndUpdate({ username }, { $set: data }, { new: true });
      return res.status(200).json({ success: true, data: user });

    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  res.status(405).json({ error: `Method ${method} Not Allowed` });
}