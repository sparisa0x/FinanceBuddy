import type { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const approveSchema = z.object({
  userId: z.string().min(1),
});

export const approveUser = asyncHandler(async (req: Request, res: Response) => {
  const result = approveSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: 'Invalid request', errors: result.error.flatten() });
  }

  const { userId } = result.data;
  await User.findByIdAndUpdate(userId, { isApproved: true });

  res.json({ message: 'User approved' });
});
