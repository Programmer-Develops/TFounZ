import multer from 'multer';

const MAX_FILE_SIZE_BYTES = 80 * 1024 * 1024; // 80 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

export default upload;
