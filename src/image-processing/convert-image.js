import sharp from 'sharp';
import { conversionOptionsSchema } from '../validations/job-operations.js';

const convertImage = async (imgBuffer, options) => {
  // validate options
  const { format } = conversionOptionsSchema.parse(options);
  
  // pass it sharp, change format, and finally export it
  return sharp(imgBuffer).toFormat(format).toBuffer();
};

export default convertImage;