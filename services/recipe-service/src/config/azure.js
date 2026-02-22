const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');

const azureConfig = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
};

// Validate configuration
const isConfigured = () => {
  return !!(
    azureConfig.endpoint &&
    azureConfig.apiKey &&
    azureConfig.deploymentName
  );
};

// Create Azure OpenAI client
let client = null;

const getClient = () => {
  if (!isConfigured()) {
    throw new Error('Azure OpenAI is not properly configured. Check environment variables.');
  }

  if (!client) {
    client = new OpenAIClient(
      azureConfig.endpoint,
      new AzureKeyCredential(azureConfig.apiKey)
    );
  }

  return client;
};

module.exports = {
  azureConfig,
  isConfigured,
  getClient,
};
