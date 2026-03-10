require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3004;

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
  console.error('Server error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  console.warn('404 - Route not found:', req.path, req.method);
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍽️  Recipe Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Accessible at: http://0.0.0.0:${PORT}`);
});

module.exports = app;
