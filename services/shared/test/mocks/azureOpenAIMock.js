const nock = require('nock');

/**
 * Mock Azure OpenAI API responses
 * Uses nock to intercept HTTP requests to Azure OpenAI endpoints
 */

// Default Azure OpenAI endpoint format
const OPENAI_BASE_URL = process.env.AZURE_OPENAI_ENDPOINT || 'https://test-openai.openai.azure.com';

/**
 * Mock successful menu suggestion response
 * @param {string} menuText - Menu items text to return
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockMenuSuggestion(menuText = '1. Pad Thai\n2. Green Curry\n3. Tom Yum Soup') {
  return nock(OPENAI_BASE_URL)
    .post(/\/openai\/deployments\/.*\/chat\/completions/)
    .query(true)
    .reply(200, {
      id: 'chatcmpl-test-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: menuText,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 20,
        total_tokens: 70,
      },
    });
}

/**
 * Mock successful recipe generation response
 * @param {string} recipeText - Recipe text to return
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockRecipeGeneration(recipeText = '## Pad Thai\n\n**Ingredients:**\n- Rice noodles\n\n**Steps:**\n1. Cook noodles') {
  return nock(OPENAI_BASE_URL)
    .post(/\/openai\/deployments\/.*\/chat\/completions/)
    .query(true)
    .reply(200, {
      id: 'chatcmpl-test-456',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: recipeText,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 150,
        total_tokens: 250,
      },
    });
}

/**
 * Mock intent classification response
 * @param {string} intent - Intent to return (e.g., 'food_related', 'not_food_related')
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockIntentClassification(intent = 'food_related') {
  return nock(OPENAI_BASE_URL)
    .post(/\/openai\/deployments\/.*\/chat\/completions/)
    .query(true)
    .reply(200, {
      id: 'chatcmpl-test-789',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: intent,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 30,
        completion_tokens: 5,
        total_tokens: 35,
      },
    });
}

/**
 * Mock Azure OpenAI API error
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} errorMessage - Error message
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockOpenAIError(statusCode = 500, errorMessage = 'Internal server error') {
  return nock(OPENAI_BASE_URL)
    .post(/\/openai\/deployments\/.*\/chat\/completions/)
    .query(true)
    .reply(statusCode, {
      error: {
        message: errorMessage,
        type: 'server_error',
        code: statusCode,
      },
    });
}

/**
 * Mock Azure OpenAI API timeout
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockOpenAITimeout() {
  return nock(OPENAI_BASE_URL)
    .post(/\/openai\/deployments\/.*\/chat\/completions/)
    .query(true)
    .replyWithError({
      code: 'ETIMEDOUT',
      message: 'Request timeout',
    });
}

/**
 * Mock Azure OpenAI API rate limit error
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockOpenAIRateLimit() {
  return nock(OPENAI_BASE_URL)
    .post(/\/openai\/deployments\/.*\/chat\/completions/)
    .query(true)
    .reply(429, {
      error: {
        message: 'Rate limit exceeded',
        type: 'rate_limit_error',
        code: 429,
      },
    });
}

/**
 * Mock custom Azure OpenAI response
 * @param {Object} response - Custom response object
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockCustomResponse(response) {
  return nock(OPENAI_BASE_URL)
    .post(/\/openai\/deployments\/.*\/chat\/completions/)
    .query(true)
    .reply(200, response);
}

/**
 * Clear all nock mocks
 */
function clearMocks() {
  nock.cleanAll();
}

/**
 * Check if all mocks have been called
 * @returns {boolean} True if all mocks satisfied
 */
function verifyMocks() {
  return nock.isDone();
}

module.exports = {
  mockMenuSuggestion,
  mockRecipeGeneration,
  mockIntentClassification,
  mockOpenAIError,
  mockOpenAITimeout,
  mockOpenAIRateLimit,
  mockCustomResponse,
  clearMocks,
  verifyMocks,
};
