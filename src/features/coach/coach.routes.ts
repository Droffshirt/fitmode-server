import { Router } from 'express';
import * as coachController from './coach.controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { addClientSchema, assignProgramSchema } from './coach.validation.js';
import { authMiddleware, coachMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(coachMiddleware);

router.post('/clients', validateRequest(addClientSchema), coachController.addClient);
router.get('/clients', coachController.getClients);
router.get('/clients/:id/progress', coachController.getClientProgress);
router.post('/assign-program', validateRequest(assignProgramSchema), coachController.assignProgram);
router.get('/analytics', coachController.getCoachAnalytics);

export default router;
