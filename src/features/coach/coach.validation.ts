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
