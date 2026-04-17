// Express app configuration (without server start - used for testing)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Skip request logger in test environment
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Inventory Service',
    timestamp: new Date().toISOString(),
  });
});

// Protected routes (require authentication)
const authMiddleware = require('./middleware/authMiddleware');
const inventoryRoutes = require('./routes/inventory');
app.use('/api/inventory', authMiddleware, inventoryRoutes);

// Internal routes (service-to-service, no auth required)
const internalRoutes = require('./routes/internal');
app.use('/internal', internalRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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
