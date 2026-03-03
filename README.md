# FinanceBuddy

Personal finance tracker for small teams (5–20 users). Track income, expenses, debts, investments, and savings goals with secure Supabase auth.

Live app: <https://financebuddy1.vercel.app>

## Tech stack

| Layer    | Technology                                       |
| :------- | :----------------------------------------------- |
| Frontend | React 18 + TypeScript + Vite + Tailwind          |
| Database | Supabase (PostgreSQL)                            |
| Auth     | Supabase Auth + OTP verification                 |
| Hosting  | Vercel (frontend), Supabase (auth + database)    |

## Local development

### Prerequisites

- Node.js 18+
- A Supabase project

### 1) Set up database schema

Run `supabase/schema.sql` in Supabase SQL Editor.

### 2) Configure environment variables

```bash
cp .env.example .env
```

Set values in `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3) Install and run

```bash
npm install
npm run dev
```

Local app: <http://localhost:5173>

## Deployment (Vercel)

1. Import repo in Vercel.
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy using existing `vercel.json`.

## Features

- OTP-based auth flow
- Dashboard with health score and net-worth trend
- Income/expense tracking
- Debt manager with EMI insights
- Investment performance tracking
- Wishlist planning
- CSV export
- Offline status banner

## Project structure

```text
components/   React UI components
context/      Auth and finance contexts
hooks/        Shared hooks
lib/          Supabase client and helpers
supabase/     SQL schema
vercel.json   Vercel deployment config
```
