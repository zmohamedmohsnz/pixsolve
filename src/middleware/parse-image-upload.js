// ─── Import Modules ─────────────────────────────────────────────────────────────

import multer from 'multer';

// ─── Constants ──────────────────────────────────────────────────────────────────

export const MAX_IMAGE_SIZE_MB = 5;

// ─── Middleware ─────────────────────────────────────────────────────────────────

// Middleware job: inspect multipart/form-data requests,
// parse the image from 'image' field, parse non-file fields,
// and saves them in `req.file` and `req.body`.

export const parseImageUpload = multer({
  // keep the image in memory as a Buffer.
  // this is the default, but I provide for explicitly.
  // with this behavior, you can inspect image by: `req.file.buffer`.
  storage: multer.memoryStorage(),

  // this controls what Multer processes and stores.
  // it doesn't guarantee network upload stops at 5MB.
  limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024 },
}).single('image'); 