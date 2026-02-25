import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export function createMailer() {
  if (!env.SMTP_EMAIL || !env.SMTP_PASSWORD) {
    throw new Error('SMTP is not configured');
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_EMAIL,
      pass: env.SMTP_PASSWORD,
    },
  });

  return { transporter, fromAddress: env.SMTP_EMAIL };
}

export async function sendOtpEmail(email: string, otp: string) {
  const { transporter, fromAddress } = createMailer();

  await transporter.sendMail({
    from: `"FinanceBuddy" <${fromAddress}>`,
    to: email,
    subject: 'Your FinanceBuddy admin login code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
        <h2>FinanceBuddy Admin Login</h2>
        <p>Your one-time code is:</p>
        <div style="font-size: 28px; letter-spacing: 6px; font-weight: bold;">${otp}</div>
        <p>This code expires in ${env.OTP_TTL_MINUTES} minutes.</p>
      </div>
    `,
  });
}
