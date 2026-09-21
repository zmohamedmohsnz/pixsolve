import sharp from 'sharp';
import { compressOptionsSchema } from '../validations/image-processing-job.js';

const compressImage = async (imgBuffer, options) => {
  // validate options
  const { quality } = compressOptionsSchema.parse(options);

  // pass the image to sharp and fetch format
  const image = sharp(imgBuffer);
  const { format } = await image.metadata();

  switch (format) {
    case 'jpeg':
      image.jpeg({ quality });
      break;
    
    case 'png':
      image.png({ quality });
      break;
    
    case 'webp':
      image.webp({ quality });
      break;
    
    default:
      throw new Error(`Unsupported image format: ${format ?? 'unknown'}`);
  }

  return image.toBuffer();
};

export default compressImage;