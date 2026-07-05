import { Router } from 'express';
import * as progressController from './progress.controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { logProgressSchema } from './progress.validation.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/', validateRequest(logProgressSchema), progressController.logProgress);
router.get('/', progressController.getProgressLogs);
router.get('/analytics', progressController.getAnalytics);

export default router;
