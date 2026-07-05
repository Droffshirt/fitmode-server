import { z } from 'zod';

export const logProgressSchema = z.object({
  body: z.object({
    bodyWeight: z.number().positive().optional(),
    waistMeasurement: z.number().positive().optional(),
    hipMeasurement: z.number().positive().optional(),
    notes: z.string().optional(),
    photoUrl: z.string().url().optional(),
    energyLevel: z.number().min(1).max(5).optional(),
  }),
});
