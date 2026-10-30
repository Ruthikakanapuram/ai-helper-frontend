
import { z } from 'zod';

export const activitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Enter at least 3 characters'),

  description: z
    .string()
    .optional()
    .default(''),

  duration: z.union([
    z.literal(20),
    z.literal(30),
    z.literal(45),
  ]),

  scheduledDate: z
    .string()
    .min(1, 'Select a scheduled date')
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Select a valid date'
    ),

  studentIds: z
    .array(z.number().int().positive())
    .min(1, 'Select at least one student'),
});

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required'),

  password: z
    .string()
    .min(1, 'Password is required'),
});
