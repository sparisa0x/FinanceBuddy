# FinanceBuddy — Project Architecture & Overview

## Project Summary

FinanceBuddy is a personal finance intelligence app with a React + TypeScript front-end, an Express/MongoDB-backed API layer (designed to run on serverless platforms like Vercel), and optional SMTP integration for email verification and notifications.

This document outlines the high-level architecture, core files, data flow, tech stack, and useful notes (including the development default credentials present in the codebase).

## High-Level Architecture

- Frontend: React + TypeScript, built with Vite. UI uses Tailwind and iconography from `lucide-react`.
- Backend/API: Node.js (Express-like handlers) + Mongoose for MongoDB. Designed for serverless deployment (see `api/finance.ts`).
- Data Storage: MongoDB (Atlas recommended) with localStorage fallback for offline mode.
- Email: SMTP via `nodemailer` for OTP and admin notifications (configurable via environment variables).

## Tech Stack

- Runtime: Node.js >= 18
- Frontend: React 18, TypeScript, Vite, Tailwind CSS
- UI Icons: lucide-react
- Charts: recharts
- Backend: Express-style handlers (Vercel-compatible), Mongoose
- Email: nodemailer
- Database: MongoDB (Atlas recommended)

Added infrastructure pieces in this repo:
- JWT-based session tokens (`jsonwebtoken`) issued on login and OAuth flows.
- Optional Redis OTP storage (use `REDIS_URL`) for production-grade OTP TTL handling.
- Basic rate-limiting and security headers using `express-rate-limit` and `helmet` for the local server.
- CI workflow: `.github/workflows/ci.yml` to run install/build on pushes and PRs.

## Key Files & Where to Look

- App entry: [index.tsx](index.tsx) and [App.tsx](App.tsx)
- Frontend components: `components/` (e.g., `Login.tsx`, `Dashboard.tsx`, `AdminPanel.tsx`)
- Context (state & auth): `context/FinanceContext.tsx` — main client-side logic, local cache, cloud sync, and admin/test backdoors
- API & server logic: `api/finance.ts` — MongoDB connection, OTP flow, user creation/approval, admin auto-seed
- Server (local dev helper): `server.js` — express server used in some setups
- Environment & setup guidance: `SETUP_GUIDE.md` and `.env` (not committed)
- Metadata / project info: `metadata.json`, `README.md`

## Data Model (Summary)

The primary user model stores:
- `username`, `password`, `displayName`, `email`
- Flags: `isApproved`, `isAdmin`
- Collections per user: `transactions`, `debts`, `investments`, `wishlist`
- `creditScores` object (e.g., `cibil`, `experian`)

Detailed schema is defined in `api/finance.ts` (Mongoose schema). See that file for field types and defaults.

## Auth & Onboarding Flow

- Registration: Frontend calls `/api/finance` to create user and triggers OTP email (OTP stored in-memory by the server). Admin approval required after verification.
- Login: Client attempts cloud login via `/api/finance?username=...&password=...`. If cloud unavailable, the app falls back to cached localStorage records.
- Session persistence: `localStorage` keys used: `finance_session` and `finance_user_{username}`.

## Admin & Development Accounts

Previously the codebase included hardcoded dev credentials and auto-seed/backdoor paths. Those have been removed and replaced with a guarded admin-creation flow and password hashing.

To create a new admin account for initial setup, use the protected `create_admin` action against the API. Example request (server must have `ADMIN_CREATION_SECRET` set):

```bash
curl -X POST https://your-host/api/finance \
  -H 'Content-Type: application/json' \
  -d '{"action":"create_admin","secret":"YOUR_SECRET","newUsername":"admin","newPassword":"StrongPass123","newDisplayName":"Admin","newEmail":"admin@example.com"}'
```

This will create an approved admin user. After initial setup you can use the Admin Panel to manage user approvals.

If you have existing user accounts with plaintext passwords in your MongoDB, run the migration script to hash them (script added at `scripts/hash_passwords.js`). Example:

```bash
export MONGODB_URI='your-uri'
node scripts/hash_passwords.js
```

The repo now uses bcrypt hashing (`bcryptjs`) for passwords and compares hashes during login.

Authentication modes supported / recommended:
- Manual registration with OTP verification (email OTP, stored in Redis when available).
- Google Sign-In (OAuth): client sends Google's `id_token` to backend, backend verifies token and upserts the user.

The API now issues JWT tokens on successful login or OAuth sign-in. You can store them in an httpOnly cookie (server sets `fb_token`) or use the returned token in `Authorization: Bearer <token>`.

## Environment Variables (important)

- `MONGODB_URI` — MongoDB connection string (required for cloud mode)
- `PORT` — server port (used by `server.js` local helper)
- `SMTP_EMAIL`, `SMTP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` — SMTP config for `nodemailer` to send OTP and notification emails

Example `.env` snippet (SETUP_GUIDE.md contains a step-by-step example):

```env
MONGODB_URI=mongodb+srv://financebuddy_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/financebuddy?retryWrites=true&w=majority
PORT=3001
SMTP_EMAIL=you@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
```

## Running Locally (quick)

Install deps:

```bash
npm install
```

Run dev frontend (Vite):

```bash
npm run dev
```

If you want the server API locally, run `server.js` (ensure `MONGODB_URI` is set for cloud mode or the API will operate with limited features). See `SETUP_GUIDE.md` for MongoDB Atlas step-by-step.

## Security & Hardening Notes

- Remove or gate the auto-seed/backdoor logic for production. The automatic seeding in `api/finance.ts` and the hardcoded checks in `context/FinanceContext.tsx` are insecure for public deployments.
- Hash passwords before storing them (currently passwords are stored in plaintext in the DB/schema). Use `bcrypt` or similar.
- Move OTP store from in-memory to a durable store (Redis) for reliability in serverless or multi-instance deployments.
- Restrict CORS origins in production and avoid returning verbose error messages.

## Useful Links (key files)

- [App entry](App.tsx)
- [Frontend context/state](context/FinanceContext.tsx)
- [Server/API](api/finance.ts)
- [Setup guide](SETUP_GUIDE.md)

---

