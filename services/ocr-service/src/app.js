// Express app configuration (without server start - used for testing)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Skip request logger in test environment
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'OCR Service',
    timestamp: new Date().toISOString(),
  });
});

// OCR routes
const ocrRoutes = require('./routes/ocr');
app.use('/api/ocr', ocrRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Handle multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: 'File upload error',
      message: err.message,
    });
  }

  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
