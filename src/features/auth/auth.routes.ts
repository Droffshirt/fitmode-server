import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.validation.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.get('/me', authMiddleware, authController.getMe);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);

export default router;
