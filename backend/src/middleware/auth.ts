import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.fb_token as string | undefined;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = { userId: payload.userId, isAdmin: payload.isAdmin };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
