require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3002;

// Connect to PostgreSQL database
connectDatabase();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📦 Inventory Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Accessible at: http://0.0.0.0:${PORT}`);
});

module.exports = app;
