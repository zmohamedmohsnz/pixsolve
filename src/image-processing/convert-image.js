import sharp from 'sharp';
import { convertOptionsSchema } from '../validations/image-processing-job.js';

const convertImage = async (imgBuffer, options) => {
  // validate options
  const { format } = convertOptionsSchema.parse(options);
  
  // pass it sharp, change format, and finally export it
  return sharp(imgBuffer).toFormat(format).toBuffer();
};

export default convertImage;