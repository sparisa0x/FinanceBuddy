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
  displayName: { type: String, default: 'Sriram Parisa' },
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
      // Auto-Seed Admin if not exists
      if (username === 'buddy' && password === '@123Buddy') {
         const existingBuddy = await UserData.findOne({ username: 'buddy' });
         if (!existingBuddy) {
            await UserData.create({
               username: 'buddy', password: '@123Buddy', displayName: 'Super Admin',
               email: 'admin@financebuddy.com', isAdmin: true, isApproved: true,
               transactions: [], debts: [], investments: [], wishlist: [], creditScores: { cibil: 900, experian: 900 }
            });
            console.log("✅ Seeded buddy admin account");
         }
      }

      const user = await UserData.findOne({ username });
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

    // REGISTER
    if (action === 'register') {
      const existing = await UserData.findOne({ username });
      if (existing) return res.status(400).json({ success: false, message: 'Username taken' });

      const isAdminEmail = email === 'sriramparisa0x@gmail.com';
      const newUser = await UserData.create({
        username, password, email, displayName: displayName || 'User',
        isApproved: isAdminEmail, isAdmin: isAdminEmail,
        transactions: [], debts: [], investments: [], wishlist: [],
        creditScores: { cibil: 750, experian: 780 }
      });

      if (!isAdminEmail) {
         await sendApprovalEmail(newUser, req.headers.host);
      }
      return res.status(200).json({ success: true, data: newUser });
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