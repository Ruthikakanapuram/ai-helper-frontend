
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

 duration: z
  .number()
  .int()
  .min(5, 'Minimum duration is 5 minutes')
  .max(120, 'Maximum duration is 120 minutes')
  .multipleOf(5, 'Duration must be in multiples of 5 minutes'),

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
