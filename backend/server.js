import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Route handlers
import authRoutes        from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import debtRoutes        from './routes/debts.js';
import investmentRoutes  from './routes/investments.js';
import wishlistRoutes    from './routes/wishlist.js';
import creditScoreRoutes from './routes/creditScores.js';
import dashboardRoutes   from './routes/dashboard.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security ────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = [
  'https://financebuddy1.vercel.app',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — please slow down.' }
  })
);

app.use(express.json());

// ── Health check ─────────────────────────────────────────────
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/profile',       authRoutes);
app.use('/api/transactions',  transactionRoutes);
app.use('/api/debts',         debtRoutes);
app.use('/api/investments',   investmentRoutes);
app.use('/api/wishlist',      wishlistRoutes);
app.use('/api/credit-scores', creditScoreRoutes);
app.use('/api/dashboard',     dashboardRoutes);

// ── Global Error Handler ──────────────────────────────────────
// express-async-errors routes all unhandled async errors here
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message || err);

  // CORS errors from our middleware
  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ error: err.message });
  }

  // Validation / client errors
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  // Generic server error (don't leak stack traces in production)
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 FinanceBuddy API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/healthz`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
