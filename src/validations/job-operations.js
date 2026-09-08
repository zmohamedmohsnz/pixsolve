import { z } from 'zod';

export const MAX_RESIZE_DIMENSION = 4096;

export const resizeOptionsSchema = z.object({
  width: z.number().int().min(1).max(MAX_RESIZE_DIMENSION),
  height: z.number().int().min(1).max(MAX_RESIZE_DIMENSION)
}).strict();

export const compressionOptionsSchema = z.object({
  quality: z.number().int().min(1).max(100)
}).strict();

export const conversionOptionsSchema = z.object({
  format: z.enum(['jpeg', 'png', 'webp'])
}).strict();