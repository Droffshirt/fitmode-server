import { Router } from 'express';
import * as coachController from './coach.controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import {
  addClientSchema,
  assignProgramSchema,
  createExerciseSchema,
  updateExerciseSchema,
  updateWorkoutDaySchema,
  updateWorkoutExerciseSchema,
} from './coach.validation.js';
import { authMiddleware, coachMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(coachMiddleware);

// ─── Client Roster ──────────────────────────────────────────────────────────
router.post('/clients', validateRequest(addClientSchema), coachController.addClient);
router.get('/clients', coachController.getClients);
router.get('/clients/:id/progress', coachController.getClientProgress);
router.post('/assign-program', validateRequest(assignProgramSchema), coachController.assignProgram);
router.get('/analytics', coachController.getCoachAnalytics);

// ─── Exercise Management ─────────────────────────────────────────────────────
router.get('/exercises', coachController.listAllExercises);
router.post('/exercises', validateRequest(createExerciseSchema), coachController.createExercise);
router.put('/exercises/:id', validateRequest(updateExerciseSchema), coachController.updateExercise);
router.delete('/exercises/:id', coachController.deleteExercise);
router.post('/exercises/import', coachController.bulkImportExercises);

// ─── Workout Plan Management ─────────────────────────────────────────────────
router.get('/workouts', coachController.getClientWorkoutPlans);
router.patch('/workout-days/:id', validateRequest(updateWorkoutDaySchema), coachController.updateWorkoutDay);
router.patch('/workout-exercises/:id', validateRequest(updateWorkoutExerciseSchema), coachController.updateWorkoutExercise);

export default router;
