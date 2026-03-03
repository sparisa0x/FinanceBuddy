# FinanceBuddy

Personal finance tracker for small teams (5–20 users). Track income, expenses, debts, investments, and savings goals with a secure, OTP-authenticated dashboard.

**Live:** https://financebuddy1.vercel.app  
**API:** Render (Node.js + Supabase)

---

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| Backend  | Node.js + Express (ESM) |
| Database | Supabase (PostgreSQL) |
| Auth     | Supabase Auth + OTP on every login |
| Hosting  | Vercel (frontend) + Render (backend) |

---

## Local Development

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

### 1. Set up the database

Run `supabase/schema.sql` in your Supabase project's **SQL Editor**.

### 2. Configure environment variables

```bash
# Frontend
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL

# Backend
cp backend/.env.example backend/.env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FRONTEND_URL
```

### 3. Install dependencies

```bash
npm install
cd backend && npm install && cd ..
```

### 4. Run locally

```bash
# Terminal 1 – Backend
cd backend && node src/server.js

# Terminal 2 – Frontend
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

---

## Deployment

### Backend → Render
1. Push repo to GitHub.
2. Create a new **Web Service** on Render, point to the `backend/` directory.
3. Set environment variables from `backend/.env.example`.
4. `render.yaml` is pre-configured for zero-config deploy.

### Frontend → Vercel
1. Import the repo in Vercel.
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL` → your Render service URL
3. `vercel.json` handles SPA routing automatically.

---

## Features

- **Auth** — Email + password with OTP on every login (60 s countdown, 3 max attempts)
- **Dashboard** — Net worth trend, health score, recent transactions, EMI burden
- **Income / Expense** — CRUD with category, monthly summary
- **Debt Manager** — EMI calculator (reducing balance), repayment progress bar
- **Investments** — Gain/loss per investment + portfolio total
- **Wishlist** — Priority-sorted goals with target date countdown
- **Export** — Download transactions, debts, investments as CSV
- **Offline banner** — Automatic offline detection

---

## Project Structure

```
├── components/       # React UI components
├── context/          # AuthContext + FinanceContext
├── hooks/            # useOnlineStatus
├── lib/              # supabaseClient.ts, api.ts
├── supabase/         # schema.sql
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/   # auth, transactions, debts, investments, wishlist, dashboard
│   │   ├── lib/      # supabase.js, calculations.js
│   │   └── middleware/
│   └── package.json
├── render.yaml
├── vercel.json
└── .env.example
```

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
