import { z } from 'zod';

export const MAX_RESIZE_DIMENSION = 4096;

export const resizeOptionsSchema = z.object({
  width: z.number().int().min(1).max(MAX_RESIZE_DIMENSION),
  height: z.number().int().min(1).max(MAX_RESIZE_DIMENSION)
}).strict();

export const compressOptionsSchema = z.object({
  quality: z.number().int().min(1).max(100)
}).strict();

export const convertOptionsSchema = z.object({
  format: z.enum(['jpeg', 'png', 'webp'])
}).strict();

// `operation` is what decides which schema to use.
export const imageProcessingSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('resize'),
    options: resizeOptionsSchema
  }).strict(),

  z.object({
    operation: z.literal('compress'),
    options: compressOptionsSchema
  }).strict(),

  z.object({
    operation: z.literal('convert'),
    options: convertOptionsSchema
  }).strict()
]);

// it is a middleware to parse `options` into an 
// JSON object because multer provides JSON string 
const parseMultipartOptions = data => {
  if (typeof data?.options === 'string') {
    try {
      return { ...data, options: JSON.parse(data.options) };
    } catch {
      return data;
    }
  }

  return data;
};

export const imageProcessingRequestSchema = z.object({
  body: z.preprocess(
    parseMultipartOptions,
    imageProcessingSchema
  ),
  query: z.unknown(),
  params: z.unknown()
}).strict();