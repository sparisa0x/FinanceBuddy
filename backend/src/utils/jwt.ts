import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessTokenPayload = {
  userId: string;
  isAdmin: boolean;
  type: 'access';
};

export type RefreshTokenPayload = {
  userId: string;
  sessionId: string;
  type: 'refresh';
};

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>) {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>) {
  return jwt.sign({ ...payload, type: 'refresh' }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
}
