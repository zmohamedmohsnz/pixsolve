import multer from 'multer';

// keep the file in memory as a buffer
// and we access it using `req.file.buffer`
const storage = multer.memoryStorage();

// creates multer middleware that accepts 
// only one file through a field called 'image'.
const uploadSingleImage = multer({ storage }).single('image');

export default uploadSingleImage;