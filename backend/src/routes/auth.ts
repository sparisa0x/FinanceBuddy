import { Router } from 'express';
import {
	login,
	logout,
	requestAdminOtp,
	refresh,
	register,
	verifyOtp,
} from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/admin/request-otp', requestAdminOtp);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/refresh', refresh);
router.post('/logout', logout);

export { router as authRouter };
