import { Router } from 'express';
import * as workoutsController from './workouts.controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import {
  generatePlanSchema,
  logSetSchema,
  completeDaySchema,
  swapExerciseSchema,
  repeatLastWeekSchema,
} from './workouts.validation.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/generate', validateRequest(generatePlanSchema), workoutsController.generatePlan);
router.get('/active', workoutsController.getActivePlan);
router.post('/log', validateRequest(logSetSchema), workoutsController.logSet);
router.post('/complete-day', validateRequest(completeDaySchema), workoutsController.completeDay);
router.get('/history', workoutsController.getWorkoutHistory);

// New swap & alternatives routes
router.get(
  '/workout-exercise/:workoutExerciseId/alternatives',
  workoutsController.getWorkoutExerciseAlternatives
);
router.post(
  '/swap-exercise',
  validateRequest(swapExerciseSchema),
  workoutsController.swapExercise
);
router.post(
  '/repeat-last-week',
  validateRequest(repeatLastWeekSchema),
  workoutsController.repeatLastWeek
);

export default router;

