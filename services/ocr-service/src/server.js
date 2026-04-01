// IMPORTANT: Tracing must be initialized FIRST, before any other requires
require('./config/tracing');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { loadSecrets } = require('../shared/secretsManager');

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize server
async function startServer() {
  try {
    // Load secrets from Vault (with .env fallback)
    console.log('🔐 Loading secrets for ocr-service...');
    const secrets = await loadSecrets('ocr-service', ['jwt_secret', 'azure_document_intelligence_key']);

    // Apply secrets to process.env
    if (secrets.jwt_secret) process.env.JWT_SECRET = secrets.jwt_secret;
    if (secrets.azure_document_intelligence_key) process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = secrets.azure_document_intelligence_key;
    if (secrets.azure_document_intelligence_endpoint) process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = secrets.azure_document_intelligence_endpoint;

    console.log('✅ Secrets loaded successfully');

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(morgan('combined'));

    // Health check endpoint (public)
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'OCR Service',
        timestamp: new Date().toISOString(),
      });
    });

    // OCR routes
    // Note: The ocr.js routes file should handle its own auth middleware for /parse endpoint
    const ocrRoutes = require('./routes/ocr');
    app.use('/api/ocr', ocrRoutes);

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
      console.log(`📷 OCR Service running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📍 Accessible at: http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start ocr-service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
