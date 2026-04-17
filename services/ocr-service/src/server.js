// IMPORTANT: Tracing must be initialized FIRST, before any other requires
require('./config/tracing');

require('dotenv').config();
const { loadSecrets } = require('../shared/secretsManager');

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

    // Load app after secrets are configured
    const app = require('./app');

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
