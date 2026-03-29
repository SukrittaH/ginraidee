const express = require('express');
const router = express.Router();
const multer = require('multer');
const ocrController = require('../controllers/ocrController');
const authMiddleware = require('../middleware/authMiddleware');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    fieldSize: 10 * 1024 * 1024, // 10MB max for base64 data in request body
  },
  fileFilter: (req, file, cb) => {
    // Accept image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Health check
router.get('/health', ocrController.health);

// Parse image with OCR (requires JWT authentication)
router.post('/parse', authMiddleware, upload.single('image'), ocrController.parseImage);

module.exports = router;
