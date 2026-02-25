import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const parsedPort = Number(process.env.PORT || 5000);
const PORT = Number.isNaN(parsedPort) ? 5000 : parsedPort;

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';

const parsedSmtpPort = Number(process.env.SMTP_PORT || 465);
const SMTP_PORT = Number.isNaN(parsedSmtpPort) ? 465 : parsedSmtpPort;
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === 'true'
  : SMTP_PORT === 465;

const parsedOtpTtl = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_TTL_MINUTES = Number.isNaN(parsedOtpTtl) ? 10 : parsedOtpTtl;

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT,
  MONGODB_URI: requireEnv('MONGODB_URI'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  REFRESH_TOKEN_SECRET: requireEnv('REFRESH_TOKEN_SECRET'),
  CLIENT_ORIGIN,
  COOKIE_SECURE,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',
  SMTP_EMAIL: process.env.SMTP_EMAIL || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT,
  SMTP_SECURE,
  OTP_TTL_MINUTES,
};
