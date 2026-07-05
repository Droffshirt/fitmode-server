import { Router } from 'express';
import * as exercisesController from './exercises.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', exercisesController.listExercises);
router.get('/:id', exercisesController.getExerciseDetails);

export default router;
