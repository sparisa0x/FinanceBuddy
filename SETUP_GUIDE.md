# FinanceBuddy Setup Guide

## 🔐 Current Authentication System

Your app **already includes**:
- ✅ Username & Password Registration
- ✅ User Login System  
- ✅ Admin Approval System
- ✅ Individual User Data Storage
- ✅ Cloud Data Sync

**No need for Google OAuth** - you already have a complete authentication system!

---

## 📋 Step-by-Step MongoDB Setup

### **Option 1: MongoDB Atlas (Cloud - FREE & RECOMMENDED)**

This is the **best option** for making your website public with online data storage.

#### Steps:

1. **Create MongoDB Atlas Account**
   - Go to: https://www.mongodb.com/cloud/atlas/register
   - Sign up with email (FREE forever tier available)

2. **Create a Free Cluster**
   - Click "Build a Database"
   - Choose **"M0 Free"** tier (512MB storage, perfect for personal use)
   - Select a cloud provider (AWS/Google Cloud/Azure)
   - Choose a region closest to you
   - Click "Create Cluster" (takes 3-5 minutes)

3. **Create Database User**
   - In left sidebar, click "Database Access"
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Username: `financebuddy_user` (or your choice)
   - Password: Generate a strong password (save it!)
   - User Privileges: "Atlas Admin" or "Read and write to any database"
   - Click "Add User"

4. **Whitelist Your IP Address**
   - In left sidebar, click "Network Access"
   - Click "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add specific IPs
   - Click "Confirm"

5. **Get Connection String**
   - Go to "Database" in left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string (looks like):
     ```
     mongodb+srv://financebuddy_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - **Replace `<password>`** with your actual database user password
   - **Add database name** before the `?`:
     ```
     mongodb+srv://financebuddy_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/financebuddy?retryWrites=true&w=majority
     ```

6. **Create `.env` File**
   - In `FinanceBuddy` folder, create a file named `.env`
   - Add your connection string:
   ```env
   MONGODB_URI=mongodb+srv://financebuddy_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/financebuddy?retryWrites=true&w=majority
   PORT=3001
   ```

---

### **Option 2: Local MongoDB (For Development Only)**

#### Windows:

1. **Download MongoDB Community Server**
   - Go to: https://www.mongodb.com/try/download/community
   - Select Windows version
   - Download & Install (use default settings)

2. **Start MongoDB**
   - MongoDB runs as a Windows Service automatically
   - Or run manually: `mongod --dbpath C:\data\db`

3. **Create `.env` File**
   ```env
   MONGODB_URI=mongodb://localhost:27017/financebuddy
   PORT=3001
   ```

⚠️ **Note**: Local MongoDB won't work when you deploy your website publicly.

---

## 🌐 Making Your Website Public

### **Option 1: Vercel (EASIEST - FREE)**

**Perfect for your React + Express app**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Add Environment Variables in Vercel**
   - Go to: https://vercel.com/dashboard
   - Create new project
   - Add Environment Variables:
     - `MONGODB_URI`: Your MongoDB Atlas connection string
     - `SMTP_EMAIL`: (optional)
     - `SMTP_PASSWORD`: (optional)

4. **Deploy**
   ```bash
   vercel
   ```

5. **Your Website URL**: `https://your-app.vercel.app`

---

### **Option 2: Heroku (FREE tier removed, but good option)**

1. Create Heroku account
2. Install Heroku CLI
3. Deploy with git
4. Add MongoDB Atlas connection string to Config Vars

---

### **Option 3: Render (FREE)**

1. Create account: https://render.com
2. Connect GitHub repo
3. Set environment variables
4. Deploy (automatic from git)

---

### **Option 4: Railway (FREE tier available)**

1. Create account: https://railway.app
2. Connect GitHub repo  
3. Add environment variables
4. Deploy

---

## 👥 How User Registration Works in Your App

### For Regular Users:

1. **User visits your website**
2. **Clicks "Create Account"**
3. **Enters**:
   - Full Name
   - Email
   - Username  
   - Password
4. **Submits registration**
   - Data saved to MongoDB
   - Account status: "Pending Approval"
   - (Optional) Email sent to you for approval

5. **Admin (you) approves the user**
   - Login with admin account
   - Go to "Admin Panel"
   - Approve or reject user

6. **User can now login**
   - Use their username & password
   - All their data is stored separately in MongoDB
   - Data syncs automatically

### For Admin (You):

- Register with admin email: `sriramparisa0x@gmail.com`
- Automatically approved with admin access
- Can access Admin Panel to manage users

---

## 🔒 Authentication Options in Your App

### ✅ **Currently Implemented:**

1. **Username/Password Registration** ✅
   - Users create account with username & password
   - Stored in MongoDB (one user per account)
   - Admin approval system

### 🔄 **Optional Additions (If you want):**

1. **Google Sign-In (OAuth)**
   - Requires Google Cloud Console setup
   - Add Firebase Authentication
   - More complex to implement

2. **Email Verification**
   - Send verification email on registration
   - User must verify before approval

3. **Password Reset**  
   - "Forgot Password" flow
   - Send reset link via email

**Recommendation**: Your current system is **perfect for a personal finance app** with controlled access. Keep it simple!

---

## 📧 Email Notifications (Optional)

If you want email alerts when users register:

### Gmail Setup:

1. **Enable 2-Factor Authentication** on your Gmail
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password

3. **Add to `.env`**:
   ```env
   SMTP_EMAIL=your_email@gmail.com
   SMTP_PASSWORD=your_16_char_app_password
   ```

---

## 🚀 Quick Start Commands

```bash
# 1. Create .env file (see above)
# 2. Install dependencies (already done)
npm install

# 3. Start Backend Server
node server.js

# 4. Start Frontend (in new terminal)
npm run dev

# 5. Open browser
http://localhost:5173
```

---

## 🗄️ Data Storage

**Your app stores data in 2 places:**

1. **MongoDB (Cloud)** - Primary storage
   - All user accounts
   - All user financial data
   - Persistent across devices

2. **LocalStorage (Browser)** - Backup
   - Works offline
   - Syncs to MongoDB when online
   - Per-device storage

**Each user has their own separate data** - completely isolated from other users.

---

## 🔐 Security Improvements (Recommended)

### Add Password Hashing:

1. Install bcrypt:
   ```bash
   npm install bcrypt
   npm install --save-dev @types/bcrypt
   ```

2. Update `server.js` to hash passwords before saving
3. Compare hashed passwords on login

---

## ❓ FAQ

**Q: Can multiple users register?**  
A: Yes! Each user creates their own account and data is stored separately.

**Q: Do I need Google API?**  
A: No! Your app already has username/password authentication.

**Q: Will data be lost if I close the browser?**  
A: No, data is saved in MongoDB and syncs automatically.

**Q: How do I make it accessible to others?**  
A: Deploy to Vercel/Render/Railway (see deployment options above).

**Q: Is it secure?**  
A: It's functional, but add password hashing for production use.

---

## 📝 Next Steps

1. ✅ Create MongoDB Atlas account
2. ✅ Get connection string  
3. ✅ Create `.env` file
4. ✅ Restart server
5. ✅ Test registration & login
6. ✅ Deploy to make it public

Need help with any step? Let me know!
