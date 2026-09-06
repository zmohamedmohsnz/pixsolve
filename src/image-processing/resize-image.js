import sharp from 'sharp';
import { z } from 'zod';

const resizeOptionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive()
}).strict(); // strict mean no more fields are allowed.

const resizeImage = async (imgBuffer, options) => {
  const { width, height } = resizeOptionsSchema.parse(options);

  // resize to the exact dimensions while preserving
  // aspect ratio and cropping from the center.
  return sharp(imgBuffer)
    .resize({
      width,
      height,
      fit: 'cover',
      position: 'centre'
    })
    .toBuffer(); // this what executes the above pipeline.
}

export default resizeImage;