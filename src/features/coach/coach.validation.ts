import { z } from 'zod';

export const addClientSchema = z.object({
  body: z.object({
    clientEmail: z.string().email('Invalid email address'),
  }),
});

export const assignProgramSchema = z.object({
  body: z.object({
    clientId: z.string(),
    goal: z.enum(['FAT_LOSS', 'MUSCLE_GAIN', 'GLUTE_GROWTH', 'TONING', 'ATHLETICISM', 'CONSISTENCY']),
    experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    equipment: z.enum(['GYM', 'HOME', 'MINIMAL', 'BOTH']),
    trainingDays: z.number().min(1).max(7),
    injuries: z.array(z.string()).optional(),
  }),
});

export const createExerciseSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Exercise name must be at least 2 characters'),
    muscleGroup: z.enum(['CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ABS', 'OBLIQUES', 'FULL_BODY']),
    secondaryMuscles: z.array(z.string()).optional(),
    equipment: z.enum(['GYM', 'HOME', 'MINIMAL', 'BOTH']),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    movementPattern: z.string().min(2),
    isCompound: z.boolean().optional(),
    contraindications: z.array(z.string()).optional(),
    coachingCues: z.array(z.string()).optional(),
    demoUrl: z.string().url().optional().or(z.literal('')),
  }),
});

export const updateExerciseSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    muscleGroup: z.enum(['CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ABS', 'OBLIQUES', 'FULL_BODY']).optional(),
    secondaryMuscles: z.array(z.string()).optional(),
    equipment: z.enum(['GYM', 'HOME', 'MINIMAL', 'BOTH']).optional(),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    movementPattern: z.string().min(2).optional(),
    isCompound: z.boolean().optional(),
    contraindications: z.array(z.string()).optional(),
    coachingCues: z.array(z.string()).optional(),
    demoUrl: z.string().url().optional().or(z.literal('')),
  }),
});

export const updateWorkoutDaySchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    focusArea: z.string().min(2).optional(),
    notes: z.string().optional(),
  }),
});

export const updateWorkoutExerciseSchema = z.object({
  body: z.object({
    sets: z.number().min(1).max(20).optional(),
    targetReps: z.string().optional(),
    restSeconds: z.number().min(0).max(600).optional(),
    notes: z.string().optional(),
  }),
});

