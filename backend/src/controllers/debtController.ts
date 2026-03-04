import type { Request, Response } from 'express';
import { z } from 'zod';
import { Debt } from '../models/Debt.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const debtSchema = z.object({
  creditor: z.string().min(1),
  amount: z.number().positive(),
  interestRate: z.number().nonnegative().optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(['active', 'paid']).optional(),
});

export const createDebt = asyncHandler(async (req: Request, res: Response) => {
  const result = debtSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: 'Invalid request', errors: result.error.flatten() });
  }

  const debt = await Debt.create({
    ...result.data,
    userId: req.user?.userId,
  });

  res.status(201).json({ data: debt });
});

export const listDebts = asyncHandler(async (req: Request, res: Response) => {
  const debts = await Debt.find({ userId: req.user?.userId }).sort({ createdAt: -1 });
  res.json({ data: debts });
});

export const deleteDebt = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await Debt.findOneAndDelete({
    _id: req.params.id,
    userId: req.user?.userId,
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Debt not found' });
  }

  res.json({ message: 'Debt deleted' });
});
