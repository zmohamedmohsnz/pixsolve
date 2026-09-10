import { v2 as cloudinary } from 'cloudinary';
import config from './env.js';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true // make cloudinary generate `https://` urls instead of `http://` 
});

// we are simply re-exporting the same imported object after configuring it.
export default cloudinary;