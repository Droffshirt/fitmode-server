import { z } from 'zod';

export const generatePlanSchema = z.object({
  body: z.object({
    goal: z.enum(['FAT_LOSS', 'MUSCLE_GAIN', 'GLUTE_GROWTH', 'TONING', 'ATHLETICISM', 'CONSISTENCY']),
    experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    equipment: z.enum(['GYM', 'HOME', 'MINIMAL', 'BOTH']),
    trainingDays: z.number().min(1).max(7),
    injuries: z.array(z.string()).optional(),
  }),
});

export const logSetSchema = z.object({
  body: z.object({
    workoutExerciseId: z.string(),
    setNumber: z.number().min(1),
    weightUsed: z.number().nonnegative().optional(),
    repsCompleted: z.number().nonnegative().optional(),
    rir: z.number().min(0).max(10).optional(),
    completed: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const completeDaySchema = z.object({
  body: z.object({
    workoutDayId: z.string(),
  }),
});

export const swapExerciseSchema = z.object({
  body: z.object({
    workoutExerciseId: z.string().uuid(),
    newExerciseId: z.string().uuid(),
  }),
});

export const repeatLastWeekSchema = z.object({
  body: z.object({
    workoutDayId: z.string().uuid(),
  }),
});

