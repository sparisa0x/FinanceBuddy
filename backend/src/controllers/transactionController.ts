import type { Request, Response } from 'express';
import { z } from 'zod';
import { Transaction } from '../models/Transaction.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().optional(),
  date: z.coerce.date().optional(),
});

export const createTransaction = asyncHandler(async (req: Request, res: Response) => {
  const result = transactionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: 'Invalid request', errors: result.error.flatten() });
  }

  const payload = result.data;
  const transaction = await Transaction.create({
    ...payload,
    date: payload.date || new Date(),
    userId: req.user?.userId,
  });

  res.status(201).json({ data: transaction });
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await Transaction.find({ userId: req.user?.userId }).sort({
    date: -1,
    createdAt: -1,
  });
  res.json({ data: transactions });
});

export const deleteTransaction = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await Transaction.findOneAndDelete({
    _id: req.params.id,
    userId: req.user?.userId,
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Transaction not found' });
  }

  res.json({ message: 'Transaction deleted' });
});
