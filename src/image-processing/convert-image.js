import sharp from 'sharp';
import { z } from 'zod';

const conversionOptionsSchema = z.object({
  format: z.enum(['jpeg', 'png', 'webp']),
}).strict();

const convertImage = async (imgBuffer, options) => {
  // validate options
  const { format } = conversionOptionsSchema.parse(options);
  
  // pass it sharp, change format, and finally export it
  return sharp(imgBuffer).toFormat(format).toBuffer();
};

export default convertImage;