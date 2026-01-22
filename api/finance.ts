import mongoose from 'mongoose';
import nodemailer from 'nodemailer';

// 1. Database Connection Logic
const MONGODB_URI = process.env.MONGODB_URI;
const SMTP_EMAIL = process.env.SMTP_EMAIL; 
const SMTP_PASSWORD = process.env.SMTP_PASSWORD; 
const NOTIFICATION_EMAIL = 'sriramparisa0x@proton.me'; 

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

let cached = (globalThis as any).mongoose;

if (!cached) {
  cached = (globalThis as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
    }).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// 2. Define the Schema
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

// Email Sender Helper
async function sendApprovalEmail(newUser: any, host: string) {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.log("SMTP credentials missing. Skipping email.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD,
    },
  });

  const approvalLink = `http://${host}/?tab=admin`; 

  const mailOptions = {
    from: SMTP_EMAIL,
    to: NOTIFICATION_EMAIL,
    subject: `New User Registration: ${newUser.displayName}`,
    html: `
      <h3>New Account Request</h3>
      <p><strong>Name:</strong> ${newUser.displayName}</p>
      <p><strong>Username:</strong> ${newUser.username}</p>
      <p><strong>Email:</strong> ${newUser.email}</p>
      <p>This account is currently <strong>PENDING</strong>.</p>
      <p>Please log in to your admin account to approve or reject this user.</p>
      <a href="${approvalLink}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Go to Admin Panel</a>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Approval email sent');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// 3. The API Handler
export default async function handler(req: any, res: any) {
  await connectToDatabase();

  const { method } = req;
  
  // LOGIN & FETCH
  if (method === 'GET') {
    const { username, password, action } = req.query;
    
    // Auto-Seed 'buddy' admin user if they try to login and don't exist
    if (username === 'buddy' && !action) {
      const existingBuddy = await UserData.findOne({ username: 'buddy' });
      if (!existingBuddy && password === '@123Buddy') {
         await UserData.create({
            username: 'buddy',
            password: '@123Buddy',
            displayName: 'Super Admin',
            email: 'admin@financebuddy.com',
            isAdmin: true,
            isApproved: true,
            transactions: [],
            debts: [],
            investments: [],
            wishlist: [],
            creditScores: { cibil: 900, experian: 900 }
         });
         console.log("Seeded buddy admin account");
      }
    }

    // Admin Action: Fetch Pending Users
    if (action === 'pending_users') {
      try {
        const pendingUsers = await UserData.find({ isApproved: false }, 'username displayName email');
        return res.status(200).json({ success: true, data: pendingUsers });
      } catch (error) {
        return res.status(500).json({ success: false, error: 'Database error' });
      }
    }

    // Standard Login
    try {
      const user = await UserData.findOne({ username });

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Check Approval
      if (!user.isApproved) {
         return res.status(403).json({ success: false, message: 'Account pending approval. Please wait for admin verification.' });
      }

      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  // SAVE / UPDATE / REGISTER / APPROVE
  if (method === 'POST') {
    const { username, data, action, password, displayName, email } = req.body;

    try {
      // ADMIN: APPROVE USER
      if (action === 'approve_user') {
         const { targetUsername, decision } = req.body; // decision: 'approve' or 'reject'
         
         if (decision === 'reject') {
            await UserData.deleteOne({ username: targetUsername });
            return res.status(200).json({ success: true, message: 'User rejected and removed' });
         } else {
            await UserData.findOneAndUpdate({ username: targetUsername }, { isApproved: true });
            return res.status(200).json({ success: true, message: 'User approved' });
         }
      }

      // REGISTER
      if (action === 'register') {
        const existing = await UserData.findOne({ username });
        if (existing) {
          return res.status(400).json({ success: false, message: 'Username already taken' });
        }
        
        // Auto-approve specific emails
        const isAdminEmail = email === 'sriramparisa0x@gmail.com';
        
        const newUser = await UserData.create({
          username,
          password,
          email,
          displayName: displayName || 'Sriram Parisa',
          isApproved: isAdminEmail, 
          isAdmin: isAdminEmail,   
          transactions: [],
          debts: [],
          investments: [],
          wishlist: [],
          creditScores: { cibil: 750, experian: 780 }
        });

        // Send Email Notification if not auto-approved
        if (!isAdminEmail) {
           const host = req.headers.host || 'localhost:3000';
           await sendApprovalEmail(newUser, host);
        }

        return res.status(200).json({ success: true, data: newUser });
      }

      // DATA SYNC / UPDATE
      const user = await UserData.findOneAndUpdate(
        { username },
        { $set: data },
        { new: true }
      );
      
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to update' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${method} Not Allowed`);
}