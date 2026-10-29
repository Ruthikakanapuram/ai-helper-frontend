import { z } from 'zod';
export const activitySchema = z.object({ name: z.string().trim().min(3, 'Enter at least 3 characters'), topic: z.string().trim().min(2, 'Topic is required'), description: z.string(), duration: z.union([z.literal(15), z.literal(30), z.literal(45)]), studentIds: z.array(z.string()).min(1, 'Select at least one student') });
export const loginSchema = z.object({ username: z.string().min(1, 'Username is required'), password: z.string().min(1, 'Password is required') });
