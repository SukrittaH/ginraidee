// IMPORTANT: Tracing must be initialized FIRST, before any other requires
require('./config/tracing');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./config/logger');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);  // Structured request logging

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Recipe Service',
    timestamp: new Date().toISOString(),
  });
});

// Recipe routes
const authMiddleware = require('./middleware/authMiddleware');
const recipeRoutes = require('./routes/recipes');
app.use('/api/recipes', authMiddleware, recipeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
  });
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info('Recipe Service started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version,
  });
  console.log(`🍽️  Recipe Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Accessible at: http://0.0.0.0:${PORT}`);
});

module.exports = app;
