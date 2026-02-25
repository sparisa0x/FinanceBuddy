import { Router } from 'express';
import {
  createWishlistItem,
  deleteWishlistItem,
  listWishlist,
} from '../controllers/wishlistController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listWishlist);
router.post('/', authMiddleware, createWishlistItem);
router.delete('/:id', authMiddleware, deleteWishlistItem);

export { router as wishlistRouter };
