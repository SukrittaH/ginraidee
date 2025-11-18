// Azure OpenAI Configuration
// Configuration is loaded from environment variables for security

export const AZURE_OPENAI_CONFIG = {
  // Your Azure OpenAI endpoint from environment variable
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',

  // Your Azure OpenAI API key from environment variable
  apiKey: process.env.AZURE_OPENAI_API_KEY || '',

  // Your deployment name from environment variable
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',

  // API version
  apiVersion: '2024-02-15-preview',
};

// Check if configuration is complete
export const isConfigured = () => {
  return !!(
    AZURE_OPENAI_CONFIG.endpoint &&
    AZURE_OPENAI_CONFIG.apiKey &&
    AZURE_OPENAI_CONFIG.deploymentName
  );
};
