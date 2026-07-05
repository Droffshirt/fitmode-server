import { z } from 'zod';

export const onboardingSchema = z.object({
  body: z.object({
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    age: z.number().min(12).max(100).optional(),
    weight: z.number().min(30).max(300).optional(),
    height: z.number().min(100).max(250).optional(),
    goal: z.enum(['FAT_LOSS', 'MUSCLE_GAIN', 'GLUTE_GROWTH', 'TONING', 'ATHLETICISM', 'CONSISTENCY']),
    experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    equipment: z.enum(['GYM', 'HOME', 'MINIMAL', 'BOTH']),
    trainingDays: z.number().min(1).max(7),
    injuries: z.array(z.string()).optional(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    age: z.number().min(12).max(100).optional(),
    weight: z.number().min(30).max(300).optional(),
    height: z.number().min(100).max(250).optional(),
    trainingDays: z.number().min(1).max(7).optional(),
  }),
});
