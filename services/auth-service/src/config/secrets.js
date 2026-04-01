/**
 * Auth Service - Secrets Configuration
 * Loads secrets from Vault or environment variables
 */

const { loadSecrets } = require('../../../shared/secretsManager');

let cachedSecrets = null;

/**
 * Load and cache secrets for auth service
 * @returns {Promise<Object>} Secrets object
 */
async function getSecrets() {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  const requiredKeys = [
    'jwt_secret',
    'entraid_client_id',
    'entraid_tenant_id',
  ];

  cachedSecrets = await loadSecrets('auth-service', requiredKeys);
  return cachedSecrets;
}

/**
 * Get specific secret value
 * @param {string} key - Secret key
 * @returns {Promise<string>} Secret value
 */
async function getSecret(key) {
  const secrets = await getSecrets();
  return secrets[key];
}

/**
 * Clear cached secrets (useful for testing)
 */
function clearCache() {
  cachedSecrets = null;
}

module.exports = {
  getSecrets,
  getSecret,
  clearCache,
};
