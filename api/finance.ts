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

// Prevent model recompilation error in serverless environment
const UserData: any = mongoose.models.UserData || mongoose.model('UserData', UserDataSchema);

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
       if (!existing && password === '@123Buddy') {
           await UserData.create({
              username: 'buddy', password: '@123Buddy', displayName: 'Super Admin',
              email: 'admin@financebuddy.com', isAdmin: true, isApproved: true,
              transactions: [], debts: [], investments: [], wishlist: [], creditScores: { cibil: 900, experian: 900 }
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
        
        const isAdminEmail = email === 'sriramparisa0x@gmail.com';
        const newUser = await UserData.create({
          username, password, email, displayName: displayName || 'User',
          isApproved: isAdminEmail, isAdmin: isAdminEmail,
          transactions: [], debts: [], investments: [], wishlist: [],
          creditScores: { cibil: 750, experian: 780 }
        });

        if (!isAdminEmail) {
           await sendApprovalEmail(newUser, req.headers.host || 'finance-buddy.vercel.app');
        }
        return res.status(200).json({ success: true, data: newUser });
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