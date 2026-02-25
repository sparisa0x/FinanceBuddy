import { Router } from 'express';
import { adminRouter } from './admin.js';
import { authRouter } from './auth.js';
import { debtRouter } from './debts.js';
import { investmentRouter } from './investments.js';
import { transactionRouter } from './transactions.js';
import { wishlistRouter } from './wishlist.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/transactions', transactionRouter);
router.use('/debts', debtRouter);
router.use('/investments', investmentRouter);
router.use('/wishlist', wishlistRouter);

export { router };
