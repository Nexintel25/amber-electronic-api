import multer from "multer";

// SP allows up to 10 photos + 2 videos per call
const MAX_FILES = 12;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (videos)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (/^(image|video)\//.test(file.mimetype)) return cb(null, true);
    cb(new Error(`${file.originalname}: only photo or video files are allowed`));
  },
});

// Reads the "media" files from form-data into req.files.
// JSON requests are skipped by multer, so they still work as before.
export const uploadMedia = (req, res, next) =>
  upload.array("media", MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({
      success: false,
      code: 1613,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "Each file must be 50 MB or smaller"
          : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
            ? `Maximum ${MAX_FILES} files allowed in "media"`
            : err.message,
    });
  });
