/**
 * Vault Client - Multi-Provider Secrets Management
 *
 * Supports:
 * - HashiCorp Vault (local development)
 * - Azure Key Vault (production)
 *
 * Usage:
 *   const vaultClient = require('../shared/vaultClient');
 *   const secrets = await vaultClient.getSecrets('auth-service');
 *   const JWT_SECRET = secrets.jwt_secret;
 */

/**
 * Simple logger fallback (in case shared logger doesn't exist yet)
 */
const simpleLogger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
};

// Use shared logger if available, otherwise use simple logger
let logger;
try {
  logger = require('./logger');
} catch (e) {
  logger = simpleLogger;
}

/**
 * Main Vault Client - Provider Factory
 */
class VaultClient {
  constructor() {
    this.provider = null;
    this.initialized = false;
  }

  /**
   * Initialize the appropriate vault provider
   */
  async initialize() {
    if (this.initialized) return;

    const vaultType = process.env.VAULT_TYPE || 'hashicorp';
    logger.info(`Initializing vault client: ${vaultType}`);

    try {
      switch (vaultType.toLowerCase()) {
        case 'hashicorp':
        case 'vault':
          this.provider = new HashiCorpVaultProvider();
          break;

        case 'azure':
        case 'azurekeyvault':
          this.provider = new AzureKeyVaultProvider();
          break;

        default:
          throw new Error(`Unsupported vault type: ${vaultType}`);
      }

      await this.provider.initialize();
      this.initialized = true;
      logger.info(`✅ Vault client initialized: ${vaultType}`);
    } catch (error) {
      logger.error(`Failed to initialize vault client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get secrets for a specific service
   * @param {string} serviceName - Name of the service (e.g., 'auth-service')
   * @returns {Promise<Object>} Secrets object
   */
  async getSecrets(serviceName) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info(`Fetching secrets for: ${serviceName}`);
      const secrets = await this.provider.getSecrets(serviceName);
      logger.info(`✅ Secrets retrieved for: ${serviceName}`);
      return secrets;
    } catch (error) {
      logger.error(`Failed to get secrets for ${serviceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a single secret value
   * @param {string} serviceName - Name of the service
   * @param {string} secretKey - Key of the secret
   * @returns {Promise<string>} Secret value
   */
  async getSecret(serviceName, secretKey) {
    const secrets = await this.getSecrets(serviceName);
    return secrets[secretKey];
  }

  /**
   * Check if vault is available
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      return await this.provider.healthCheck();
    } catch (error) {
      logger.warn(`Vault health check failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * HashiCorp Vault Provider
 */
class HashiCorpVaultProvider {
  constructor() {
    this.vault = null;
    this.vaultAddr = process.env.VAULT_ADDR || 'http://vault:8200';
    this.vaultToken = process.env.VAULT_TOKEN || 'dev-root-token';
  }

  async initialize() {
    try {
      // Lazy load node-vault to avoid requiring it when not used
      const nodeVault = require('node-vault');

      this.vault = nodeVault({
        endpoint: this.vaultAddr,
        token: this.vaultToken,
      });

      // Test connection
      await this.vault.health();
      logger.info(`Connected to HashiCorp Vault: ${this.vaultAddr}`);
    } catch (error) {
      throw new Error(`Failed to connect to HashiCorp Vault: ${error.message}`);
    }
  }

  async getSecrets(serviceName) {
    try {
      // KV v2 engine: path is secret/data/{serviceName}
      const path = `secret/data/${serviceName}`;
      const result = await this.vault.read(path);

      // KV v2 response structure: { data: { data: { actual_secrets } } }
      return result.data.data;
    } catch (error) {
      if (error.response && error.response.statusCode === 404) {
        throw new Error(`Secrets not found for service: ${serviceName}`);
      }
      throw new Error(`Failed to read secrets from Vault: ${error.message}`);
    }
  }

  async healthCheck() {
    try {
      const health = await this.vault.health();
      return health.sealed === false;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Azure Key Vault Provider
 */
class AzureKeyVaultProvider {
  constructor() {
    this.client = null;
    this.vaultUrl = process.env.AZURE_KEYVAULT_URL;

    if (!this.vaultUrl) {
      throw new Error('AZURE_KEYVAULT_URL environment variable is required for Azure Key Vault');
    }
  }

  async initialize() {
    try {
      // Lazy load Azure SDK to avoid requiring it when not used
      const { SecretClient } = require('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = require('@azure/identity');

      // Use Managed Identity in production, falls back to Azure CLI credentials locally
      const credential = new DefaultAzureCredential();
      this.client = new SecretClient(this.vaultUrl, credential);

      logger.info(`Connected to Azure Key Vault: ${this.vaultUrl}`);
    } catch (error) {
      throw new Error(`Failed to connect to Azure Key Vault: ${error.message}`);
    }
  }

  async getSecrets(serviceName) {
    try {
      const secrets = {};

      // Azure Key Vault stores secrets individually
      // Naming convention: {serviceName}-{secretName}
      // Example: auth-service-jwt-secret

      // Get list of all secrets with this service prefix
      const secretIterator = this.client.listPropertiesOfSecrets();
      const prefix = `${serviceName}-`;

      for await (const secretProperties of secretIterator) {
        if (secretProperties.name.startsWith(prefix)) {
          try {
            const secret = await this.client.getSecret(secretProperties.name);

            // Convert from kebab-case to snake_case
            // auth-service-jwt-secret -> jwt_secret
            const key = secretProperties.name
              .replace(prefix, '')
              .replace(/-/g, '_');

            secrets[key] = secret.value;
          } catch (error) {
            logger.warn(`Failed to get secret ${secretProperties.name}: ${error.message}`);
          }
        }
      }

      if (Object.keys(secrets).length === 0) {
        throw new Error(`No secrets found for service: ${serviceName}`);
      }

      return secrets;
    } catch (error) {
      throw new Error(`Failed to read secrets from Azure Key Vault: ${error.message}`);
    }
  }

  async healthCheck() {
    try {
      // Try to list secrets to verify connection
      const iterator = this.client.listPropertiesOfSecrets();
      await iterator.next();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new VaultClient();
