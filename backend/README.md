# FinanceBuddy Backend

Production-minded Express + TypeScript backend for FinanceBuddy.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file using the example:

```bash
cp .env.example .env
```

3. Start in dev mode:

```bash
npm run dev
```

## Environment Variables

- `PORT`: Server port (default 5000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Access token signing secret
- `REFRESH_TOKEN_SECRET`: Refresh token signing secret
- `CLIENT_ORIGIN`: Allowed frontend origin for CORS
- `COOKIE_SECURE`: `true` for HTTPS environments

## API Overview

Base path: `/api`

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/admin/approve-user`
- `GET /api/transactions`
- `POST /api/transactions`
- `DELETE /api/transactions/:id`
- `GET /api/debts`
- `POST /api/debts`
- `DELETE /api/debts/:id`
- `GET /api/investments`
- `POST /api/investments`
- `DELETE /api/investments/:id`
- `GET /api/wishlist`
- `POST /api/wishlist`
- `DELETE /api/wishlist/:id`

## Notes

- Access tokens are short-lived and stored in HttpOnly cookies.
- Refresh tokens are rotated and stored server-side as hashed values.
