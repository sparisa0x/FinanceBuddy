import { Router } from 'express';
import { approveUser } from '../controllers/adminController.js';
import { adminOnly } from '../middleware/admin.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/approve-user', authMiddleware, adminOnly, approveUser);

export { router as adminRouter };
