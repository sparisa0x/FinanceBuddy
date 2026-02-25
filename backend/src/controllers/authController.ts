import crypto from 'crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { comparePassword } from '../utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
});

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
});

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const baseOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict' as const,
  };

  res.cookie('fb_token', accessToken, {
    ...baseOptions,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('fb_refresh', refreshToken, {
    ...baseOptions,
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('fb_token');
  res.clearCookie('fb_refresh', { path: '/api/auth/refresh' });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: 'Invalid request', errors: result.error.flatten() });
  }

  const { username, email, password, displayName } = result.data;
  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if (existing) {
    return res.status(409).json({ message: 'Username or email already in use' });
  }

  await User.create({ username, email, password, displayName });

  res.status(201).json({ message: 'Registration submitted for approval' });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: 'Invalid request', errors: result.error.flatten() });
  }

  const { username, password } = result.data;
  const user = await User.findOne({ username }).select('+password');
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (!user.isApproved || !user.isActive) {
    return res.status(403).json({ message: 'Account not approved' });
  }

  const ok = await comparePassword(password, user.password);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const sessionId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ userId: user.id, sessionId });
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Session.create({
    sessionId,
    userId: user.id,
    tokenHash,
    expiresAt,
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  const accessToken = signAccessToken({ userId: user.id, isAdmin: user.isAdmin });
  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
    },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.fb_refresh as string | undefined;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (payload.type !== 'refresh') {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const session = await Session.findOne({ sessionId: payload.sessionId, userId: payload.userId });
  if (!session || session.revokedAt) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await Session.deleteOne({ _id: session.id });
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const tokenHash = hashToken(refreshToken);
  if (tokenHash !== session.tokenHash) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const newRefreshToken = signRefreshToken({ userId: user.id, sessionId: session.sessionId });
  session.tokenHash = hashToken(newRefreshToken);
  session.lastUsedAt = new Date();
  await session.save();

  const accessToken = signAccessToken({ userId: user.id, isAdmin: user.isAdmin });
  setAuthCookies(res, accessToken, newRefreshToken);

  res.json({ message: 'Token refreshed' });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.fb_refresh as string | undefined;
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await Session.findOneAndDelete({
        sessionId: payload.sessionId,
        userId: payload.userId,
      });
    } catch {
      // ignore invalid refresh token
    }
  }

  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
});
