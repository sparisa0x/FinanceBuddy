import type { NextFunction, Request, Response } from 'express';

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}
