require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDatabase } = require('./config/database');
const { loadSecrets } = require('../shared/secretsManager');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize server
async function startServer() {
  try {
    // Load secrets from Vault (with .env fallback)
    console.log('🔐 Loading secrets for auth-service...');
    const secrets = await loadSecrets('auth-service', ['jwt_secret', 'entraid_client_id']);

    // Apply secrets to process.env
    if (secrets.jwt_secret) process.env.JWT_SECRET = secrets.jwt_secret;
    if (secrets.entraid_client_id) process.env.ENTRAID_CLIENT_ID = secrets.entraid_client_id;
    if (secrets.entraid_tenant_id) process.env.ENTRAID_TENANT_ID = secrets.entraid_tenant_id;
    if (secrets.entraid_authority) process.env.ENTRAID_AUTHORITY = secrets.entraid_authority;
    if (secrets.entraid_issuer) process.env.ENTRAID_ISSUER = secrets.entraid_issuer;
    if (secrets.entraid_jwks_uri) process.env.ENTRAID_JWKS_URI = secrets.entraid_jwks_uri;

    console.log('✅ Secrets loaded successfully');

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
        service: 'Auth Service',
        timestamp: new Date().toISOString(),
      });
    });

    // Auth routes
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);

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
      console.log(`🔐 Auth Service running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📍 Accessible at: http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start auth-service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
