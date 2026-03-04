import { Router } from 'express';
import {
  createInvestment,
  deleteInvestment,
  listInvestments,
} from '../controllers/investmentController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listInvestments);
router.post('/', authMiddleware, createInvestment);
router.delete('/:id', authMiddleware, deleteInvestment);

export { router as investmentRouter };
