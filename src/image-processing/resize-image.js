import sharp from 'sharp';
import { resizeOptionsSchema } from '../validations/job-operations.js';

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