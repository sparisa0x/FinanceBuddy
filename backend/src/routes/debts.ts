import { Router } from 'express';
import { createDebt, deleteDebt, listDebts } from '../controllers/debtController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listDebts);
router.post('/', authMiddleware, createDebt);
router.delete('/:id', authMiddleware, deleteDebt);

export { router as debtRouter };
