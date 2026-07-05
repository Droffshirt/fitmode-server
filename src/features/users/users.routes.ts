import { Router } from 'express';
import * as usersController from './users.controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { onboardingSchema, updateProfileSchema } from './users.validation.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/onboarding', validateRequest(onboardingSchema), usersController.saveOnboarding);
router.put('/profile', validateRequest(updateProfileSchema), usersController.updateProfile);

export default router;
