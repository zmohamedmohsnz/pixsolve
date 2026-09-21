import { v2 as cloudinary } from 'cloudinary'; // Cloudinary SDK
import config from './env.js';

// store the config inside the SDK to get be used
// during sending HTTP requests to Cloudinary server.
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,

  // tells Cloudinary to generate `https://` urls
  // instead of `http://` for delivered assets.
  secure: true 
});

// we are simply re-exporting the same imported object after configuring it.
export default cloudinary;