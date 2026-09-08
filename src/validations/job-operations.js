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

// this schema says that `operation` field that will be in the passed
// object during parsing is what decides which shape the object must have.
export const jobOperationSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('resize'), // means the value must be exactly.
    options: resizeOptionsSchema
  }).strict(),

  z.object({
    operation: z.literal('compress'),
    options: compressionOptionsSchema
  }).strict(),

  z.object({
    operation: z.literal('convert'),
    options: conversionOptionsSchema
  }).strict()
]);

// it is a middleware to parse `options` into an 
// JSON object because multer provides JSON string 
const parseMultipartOptions = value => {
  if (typeof value?.options === 'string') {
    try {
      return { ...value, options: JSON.parse(value.options) };
    } catch {
      return value;
    }
  }

  return value;
};

export const jobOperationRequestSchema = z.object({
  body: z.preprocess(
    parseMultipartOptions,
    jobOperationSchema
  ),
  query: z.unknown(),
  params: z.unknown()
}).strict();