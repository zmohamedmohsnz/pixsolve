import multer from 'multer';

export const MAX_IMAGE_SIZE_MB = 5;

// keep the uploaded file in memory as a buffer
// so we inspect it using `req.file.buffer`
const storage = multer.memoryStorage();

// creates multer middleware that accepts 
// only one file through a field called 'image'.
//
// stops retaining the file data once it exceeds 5 MB.
// this is not stop the file from being sent to the server.
const uploadSingleImage = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024 }
}).single('image');

export default uploadSingleImage;