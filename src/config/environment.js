/**
 * Environment Configuration
 * Loads API endpoints and settings based on current environment
 *
 * For React Native/Expo, we use a custom configuration file since
 * process.env doesn't work in React Native like it does in web apps.
 *
 * To switch environments:
 * - Local: Manually change ENVIRONMENT variable below to 'local'
 * - Azure: Keep ENVIRONMENT as 'production' or manually set to 'production'
 */

// Manually set environment or detect from __DEV__ (Expo development mode)
const ENVIRONMENT = __DEV__ ? 'local' : 'production';

const environments = {
  // Local development environment (Microservices)
  local: {
    // Microservices Architecture - 4 separate services on different ports
    AUTH_URL: 'http://localhost:3001/api',
    INVENTORY_URL: 'http://localhost:3002/api',
    OCR_URL: 'http://localhost:3003/api',
    RECIPE_URL: 'http://localhost:3004/api',

    // Legacy fallback (if needed)
    API_BASE_URL: 'http://localhost:3001/api',

    // For different device types:
    // iOS Simulator: http://localhost:3002/api (replace localhost with your computer IP)
    // Android Emulator: http://10.0.2.2:3002/api
    // Physical Device: http://localhost:3002/api (must be on same WiFi network)

    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || '',
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || '',
    AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
    // EntraID (Azure AD) Authentication
    ENTRAID_CLIENT_ID: 'f2f1830a-e181-44ed-aa95-e5c9f7d34c6b',
    ENTRAID_TENANT_ID: 'common',
    ENTRAID_REDIRECT_URI: 'msalf2f1830a-e181-44ed-aa95-e5c9f7d34c6b://auth',
    DEBUG: true,
  },

  // Production environment (Azure)
  production: {
    API_BASE_URL: 'https://ginraidee-api.azurewebsites.net/api',
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || '',
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || '',
    AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5-chat',
    // EntraID (Azure AD) Authentication
    ENTRAID_CLIENT_ID: 'f2f1830a-e181-44ed-aa95-e5c9f7d34c6b',
    ENTRAID_TENANT_ID: 'common',
    ENTRAID_REDIRECT_URI: 'msalf2f1830a-e181-44ed-aa95-e5c9f7d34c6b://auth',
    DEBUG: false,
  },
};

const config = environments[ENVIRONMENT];

if (!config) {
  throw new Error(
    `Unknown environment: ${ENVIRONMENT}. Available: ${Object.keys(environments).join(', ')}`
  );
}

// Log current environment
console.log(`🔧 Environment: ${ENVIRONMENT}`);
console.log(`🔗 API Base URL: ${config.API_BASE_URL}`);

export default config;
export { ENVIRONMENT };
