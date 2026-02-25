import type { Request, Response } from 'express';
import { z } from 'zod';
import { Investment } from '../models/Investment.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const investmentSchema = z.object({
  type: z.string().min(1),
  investedAmount: z.number().positive(),
  currentValue: z.number().positive(),
  notes: z.string().optional(),
});

export const createInvestment = asyncHandler(async (req: Request, res: Response) => {
  const result = investmentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: 'Invalid request', errors: result.error.flatten() });
  }

  const investment = await Investment.create({
    ...result.data,
    userId: req.user?.userId,
  });

  res.status(201).json({ data: investment });
});

export const listInvestments = asyncHandler(async (req: Request, res: Response) => {
  const investments = await Investment.find({ userId: req.user?.userId }).sort({
    createdAt: -1,
  });
  res.json({ data: investments });
});

export const deleteInvestment = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await Investment.findOneAndDelete({
    _id: req.params.id,
    userId: req.user?.userId,
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Investment not found' });
  }

  res.json({ message: 'Investment deleted' });
});
