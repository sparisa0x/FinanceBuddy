import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// OTP Store (in-memory for simplicity, cleared on server restart)
const otpStore = new Map(); // email -> { otp, username, password, displayName, email, expiresAt }

// OTP Helper
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  const SMTP_EMAIL = process.env.SMTP_EMAIL;
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
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

// 1. Database Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing in .env file");
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));
}

// 2. Define Schema
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

const UserData = mongoose.models.UserData || mongoose.model('UserData', UserDataSchema);

// Email Helper
async function sendApprovalEmail(newUser, host) {
  const SMTP_EMAIL = process.env.SMTP_EMAIL;
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
  const NOTIFICATION_EMAIL = 'sriramparisa0x@proton.me';

  if (!SMTP_EMAIL || !SMTP_PASSWORD) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: SMTP_EMAIL,
      to: NOTIFICATION_EMAIL,
      subject: `New User Registration: ${newUser.displayName}`,
      html: `
        <h3>New Account Request</h3>
        <p><strong>Name:</strong> ${newUser.displayName}</p>
        <p><strong>Username:</strong> ${newUser.username}</p>
        <a href="http://${host}/?tab=admin">Go to Admin Panel</a>
      `,
    });
    console.log('Approval email sent');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// 3. API Routes

// Health Check / Ping
app.get('/api/finance', async (req, res) => {
  const { action, username, password } = req.query;

  // PING
  if (action === 'ping') {
    if (mongoose.connection.readyState === 1) {
      return res.status(200).json({ success: true, message: 'MongoDB Connected', mode: 'cloud' });
    } else {
      return res.status(500).json({ success: false, message: 'MongoDB Not Connected' });
    }
  }

  // PENDING USERS (Admin)
  if (action === 'pending_users') {
    try {
      const pendingUsers = await UserData.find({ isApproved: false }, 'username displayName email');
      return res.status(200).json({ success: true, data: pendingUsers });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  // LOGIN
  if (username && password) {
    try {
      let user;

      // Auto-Seed / Refresh Admin account
      if (username === 'buddy' && password === '123@Buddy') {
        user = await UserData.findOneAndUpdate(
          { username: 'buddy' },
          {
            $set: {
              password: '123@Buddy',
              displayName: 'Super Admin',
              email: 'admin@financebuddy.com',
              isAdmin: true,
              isApproved: true
            },
            $setOnInsert: {
              transactions: [],
              debts: [],
              investments: [],
              wishlist: [],
              creditScores: { cibil: 900, experian: 900 }
            }
          },
          { upsert: true, new: true }
        );
      }

      // Auto-Seed / Refresh Test User account
      if (username === 'pumpkin' && password === '@123Buddy') {
        user = await UserData.findOneAndUpdate(
          { username: 'pumpkin' },
          {
            $set: {
              password: '@123Buddy',
              displayName: 'Pumpkin',
              email: 'pumpkin@financebuddy.com',
              isAdmin: false,
              isApproved: true
            },
            $setOnInsert: {
              transactions: [],
              debts: [],
              investments: [],
              wishlist: [],
              creditScores: { cibil: 750, experian: 780 }
            }
          },
          { upsert: true, new: true }
        );
      }

      if (!user) {
        user = await UserData.findOne({ username });
      }
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });
      if (user.password !== password) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      if (!user.isApproved) return res.status(403).json({ success: false, message: 'Account pending approval.' });

      return res.status(200).json({ success: true, data: user });
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
          await UserData.deleteOne({ username: targetUsername });
          return res.status(200).json({ success: true, message: 'User rejected' });
       } else {
          await UserData.findOneAndUpdate({ username: targetUsername }, { isApproved: true });
          return res.status(200).json({ success: true, message: 'User approved' });
       }
    }

    // REGISTER - Step 1: Send OTP
    if (action === 'register') {
      const existing = await UserData.findOne({ username });
      if (existing) return res.status(400).json({ success: false, message: 'Username taken' });

      // Check if email is already used
      const emailExists = await UserData.findOne({ email });
      if (emailExists) return res.status(400).json({ success: false, message: 'Email already registered' });

      // Generate and send OTP
      const otp = generateOTP();
      otpStore.set(email, {
        otp,
        username,
        password,
        displayName: displayName || 'User',
        email,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      });

      const emailSent = await sendOTPEmail(email, otp);
      if (!emailSent && process.env.SMTP_EMAIL) {
        return res.status(500).json({ success: false, message: 'Failed to send verification email. Try again.' });
      }

      return res.status(200).json({ success: true, message: 'OTP sent to your email', requiresOTP: true });
    }

    // REGISTER - Step 2: Verify OTP
    if (action === 'verify_otp') {
      const { otp } = req.body;
      const stored = otpStore.get(email);
      
      if (!stored) return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });
      if (Date.now() > stored.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
      }
      if (stored.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP. Try again.' });

      // OTP verified — create user
      const newUser = await UserData.create({
        username: stored.username, password: stored.password, email: stored.email,
        displayName: stored.displayName,
        isApproved: false, isAdmin: false,
        transactions: [], debts: [], investments: [], wishlist: [],
        creditScores: { cibil: 750, experian: 780 }
      });

      otpStore.delete(email);
      await sendApprovalEmail(newUser, req.headers.host);
      return res.status(200).json({ success: true, data: newUser });
    }

    // RESEND OTP
    if (action === 'resend_otp') {
      const stored = otpStore.get(email);
      if (!stored) return res.status(400).json({ success: false, message: 'No pending registration found.' });

      const newOtp = generateOTP();
      stored.otp = newOtp;
      stored.expiresAt = Date.now() + 10 * 60 * 1000;
      otpStore.set(email, stored);

      await sendOTPEmail(email, newOtp);
      return res.status(200).json({ success: true, message: 'New OTP sent to your email' });
    }

    // SYNC DATA
    if (username && data) {
       const user = await UserData.findOneAndUpdate({ username }, { $set: data }, { new: true });
       return res.status(200).json({ success: true, data: user });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Backend Server running on http://localhost:${PORT}`);
  console.log(`➜  API Endpoint: http://localhost:${PORT}/api/finance`);
});