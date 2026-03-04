import type { Request, Response } from 'express';
import { z } from 'zod';
import { Wishlist } from '../models/Wishlist.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const wishlistSchema = z.object({
  itemName: z.string().min(1),
  targetAmount: z.number().positive(),
  savedAmount: z.number().nonnegative().optional(),
});

export const createWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  const result = wishlistSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: 'Invalid request', errors: result.error.flatten() });
  }

  const item = await Wishlist.create({
    ...result.data,
    userId: req.user?.userId,
  });

  res.status(201).json({ data: item });
});

export const listWishlist = asyncHandler(async (req: Request, res: Response) => {
  const items = await Wishlist.find({ userId: req.user?.userId }).sort({ createdAt: -1 });
  res.json({ data: items });
});

export const deleteWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await Wishlist.findOneAndDelete({
    _id: req.params.id,
    userId: req.user?.userId,
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Wishlist item not found' });
  }

  res.json({ message: 'Wishlist item deleted' });
});
