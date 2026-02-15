import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const SMTP_EMAIL = process.env.SMTP_EMAIL; 
const SMTP_PASSWORD = process.env.SMTP_PASSWORD; 
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

// OTP Store (in-memory — works with Vercel hot instances)
const otpStore = new Map();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.warn("SMTP not configured, OTP:", otp);
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `"FinanceBuddy" <${SMTP_EMAIL}>`,
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
  if (!SMTP_EMAIL || !SMTP_PASSWORD) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
  });

  const approvalLink = `https://${host}/?tab=admin`; 

  try {
    await transporter.sendMail({
      from: SMTP_EMAIL,
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
    
    // Auto-Seed Admin
    if (username === 'buddy') {
       const existing = await UserData.findOne({ username: 'buddy' });
       if (!existing && password === '123@Buddy') {
           await UserData.create({
              username: 'buddy', password: '123@Buddy', displayName: 'Super Admin',
              email: 'admin@financebuddy.com', isAdmin: true, isApproved: true,
              transactions: [], debts: [], investments: [], wishlist: [], creditScores: { cibil: 900, experian: 900 }
           });
       }
    }

    // Auto-Seed Test User
    if (username === 'pumpkin') {
       const existing = await UserData.findOne({ username: 'pumpkin' });
       if (!existing && password === '@123Buddy') {
           await UserData.create({
              username: 'pumpkin', password: '@123Buddy', displayName: 'Pumpkin',
              email: 'pumpkin@financebuddy.com', isAdmin: false, isApproved: true,
              transactions: [], debts: [], investments: [], wishlist: [], creditScores: { cibil: 750, experian: 780 }
           });
       }
    }

    if (action === 'pending_users') {
      const pendingUsers = await UserData.find({ isApproved: false }, 'username displayName email');
      return res.status(200).json({ success: true, data: pendingUsers });
    }

    try {
      const user = await UserData.findOne({ username });
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });
      if (user.password !== password) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      if (!user.isApproved) return res.status(403).json({ success: false, message: 'Pending approval' });

      return res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST ACTIONS
  if (method === 'POST') {
    const { username, data, action, password, displayName, email } = body;

    try {
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
        otpStore.set(email, {
          otp, username, password, displayName: displayName || 'User', email,
          expiresAt: Date.now() + 10 * 60 * 1000
        });

        const emailSent = await sendOTPEmail(email, otp);
        if (!emailSent && SMTP_EMAIL) {
          return res.status(500).json({ success: false, message: 'Failed to send verification email.' });
        }
        return res.status(200).json({ success: true, message: 'OTP sent to your email', requiresOTP: true });
      }

      if (action === 'verify_otp') {
        const { otp } = body;
        const stored = otpStore.get(email);

        if (!stored) return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });
        if (Date.now() > stored.expiresAt) {
          otpStore.delete(email);
          return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
        }
        if (stored.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP. Try again.' });

        const newUser = await UserData.create({
          username: stored.username, password: stored.password, email: stored.email,
          displayName: stored.displayName,
          isApproved: false, isAdmin: false,
          transactions: [], debts: [], investments: [], wishlist: [],
          creditScores: { cibil: 750, experian: 780 }
        });

        otpStore.delete(email);
        await sendApprovalEmail(newUser, req.headers.host || 'finance-buddy.vercel.app');
        return res.status(200).json({ success: true, data: newUser });
      }

      if (action === 'resend_otp') {
        const stored = otpStore.get(email);
        if (!stored) return res.status(400).json({ success: false, message: 'No pending registration found.' });

        const newOtp = generateOTP();
        stored.otp = newOtp;
        stored.expiresAt = Date.now() + 10 * 60 * 1000;
        otpStore.set(email, stored);

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