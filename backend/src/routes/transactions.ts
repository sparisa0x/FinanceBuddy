import { Router } from 'express';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
} from '../controllers/transactionController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listTransactions);
router.post('/', authMiddleware, createTransaction);
router.delete('/:id', authMiddleware, deleteTransaction);

export { router as transactionRouter };
