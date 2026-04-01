/**
 * Secrets Manager - Hybrid Vault + Environment Variables
 *
 * Priority:
 * 1. Vault (if VAULT_ENABLED=true and vault is available)
 * 2. Environment variables (.env files)
 * 3. Error if required secrets missing
 *
 * Usage:
 *   const { loadSecrets } = require('../shared/secretsManager');
 *   const secrets = await loadSecrets('auth-service', ['JWT_SECRET', 'ENTRAID_CLIENT_ID']);
 */

const vaultClient = require('./vaultClient');
const logger = require('./logger');

/**
 * Load secrets for a service with fallback to environment variables
 *
 * @param {string} serviceName - Name of the service (e.g., 'auth-service')
 * @param {Array<string>} requiredKeys - Array of required secret keys (optional)
 * @returns {Promise<Object>} Secrets object
 */
async function loadSecrets(serviceName, requiredKeys = []) {
  const secrets = {};
  const vaultEnabled = process.env.VAULT_ENABLED === 'true';

  logger.info(`Loading secrets for ${serviceName}...`);

  // Try Vault first if enabled
  if (vaultEnabled) {
    try {
      logger.info(`🔐 Attempting to load from Vault (type: ${process.env.VAULT_TYPE || 'hashicorp'})`);
      const vaultSecrets = await vaultClient.getSecrets(serviceName);

      // Copy all vault secrets
      Object.assign(secrets, vaultSecrets);

      logger.info(`✅ Secrets loaded from Vault for ${serviceName}`);
      logger.debug(`Loaded keys: ${Object.keys(vaultSecrets).join(', ')}`);
    } catch (error) {
      logger.warn(`⚠️  Vault unavailable, falling back to environment variables: ${error.message}`);
    }
  } else {
    logger.info('📄 Vault disabled (VAULT_ENABLED not set to true), using environment variables');
  }

  // Fallback to environment variables for missing secrets
  const envVars = getEnvironmentVariables(serviceName);
  for (const [key, value] of Object.entries(envVars)) {
    if (!secrets[key] && value !== undefined) {
      secrets[key] = value;
    }
  }

  // Log final source of secrets
  const vaultCount = Object.keys(secrets).length - Object.keys(envVars).filter(([k, v]) => secrets[k] === v).length;
  const envCount = Object.keys(envVars).length;
  logger.info(`Loaded secrets: ${vaultCount} from Vault, ${envCount} from environment`);

  // Validate required keys
  if (requiredKeys.length > 0) {
    validateRequiredKeys(secrets, requiredKeys, serviceName);
  }

  return secrets;
}

/**
 * Get environment variables for a service
 * Maps environment variable names to snake_case keys
 */
function getEnvironmentVariables(serviceName) {
  const env = process.env;
  const secrets = {};

  // Common mappings based on service
  switch (serviceName) {
    case 'auth-service':
      secrets.jwt_secret = env.JWT_SECRET;
      secrets.entraid_client_id = env.ENTRAID_CLIENT_ID;
      secrets.entraid_tenant_id = env.ENTRAID_TENANT_ID;
      secrets.entraid_authority = env.ENTRAID_AUTHORITY;
      secrets.entraid_issuer = env.ENTRAID_ISSUER;
      secrets.entraid_jwks_uri = env.ENTRAID_JWKS_URI;
      break;

    case 'recipe-service':
      secrets.jwt_secret = env.JWT_SECRET;
      secrets.azure_openai_api_key = env.AZURE_OPENAI_API_KEY;
      secrets.azure_openai_endpoint = env.AZURE_OPENAI_ENDPOINT;
      secrets.azure_openai_deployment_name = env.AZURE_OPENAI_DEPLOYMENT_NAME;
      break;

    case 'ocr-service':
      secrets.jwt_secret = env.JWT_SECRET;
      secrets.azure_document_intelligence_endpoint = env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
      secrets.azure_document_intelligence_key = env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
      break;

    case 'inventory-service':
      secrets.jwt_secret = env.JWT_SECRET;
      break;

    case 'database':
      secrets.url = env.DATABASE_URL;
      secrets.username = env.DB_USERNAME || 'postgres';
      secrets.password = env.DB_PASSWORD;
      secrets.host = env.DB_HOST || 'postgres';
      secrets.port = env.DB_PORT || '5432';
      secrets.database = env.DB_NAME || 'ginraidee';
      break;

    default:
      logger.warn(`No environment variable mapping defined for service: ${serviceName}`);
  }

  // Remove undefined values
  return Object.fromEntries(
    Object.entries(secrets).filter(([_, value]) => value !== undefined)
  );
}

/**
 * Validate that all required keys are present
 */
function validateRequiredKeys(secrets, requiredKeys, serviceName) {
  const missingKeys = requiredKeys.filter(key => !secrets[key]);

  if (missingKeys.length > 0) {
    const error = new Error(
      `Missing required secrets for ${serviceName}: ${missingKeys.join(', ')}\n` +
      `Check Vault or environment variables (.env file)`
    );
    logger.error(error.message);
    throw error;
  }

  logger.info(`✅ All required secrets present for ${serviceName}`);
}

/**
 * Convert secrets object to uppercase environment variable format
 * Useful for backwards compatibility with existing code
 */
function toEnvFormat(secrets) {
  const env = {};
  for (const [key, value] of Object.entries(secrets)) {
    const envKey = key.toUpperCase();
    env[envKey] = value;
  }
  return env;
}

/**
 * Check if Vault is healthy
 */
async function vaultHealthCheck() {
  if (process.env.VAULT_ENABLED !== 'true') {
    return { healthy: false, reason: 'Vault not enabled' };
  }

  try {
    const healthy = await vaultClient.healthCheck();
    return {
      healthy,
      reason: healthy ? 'Vault is healthy' : 'Vault is sealed or unreachable',
    };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}

module.exports = {
  loadSecrets,
  toEnvFormat,
  vaultHealthCheck,
};
