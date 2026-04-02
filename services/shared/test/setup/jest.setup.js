/**
 * Global Jest Setup
 * Loaded before all tests run
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-do-not-use-in-production';
process.env.VAULT_ENABLED = 'false'; // Disable Vault in tests for speed

// Mock console methods to reduce test output noise
// Real errors will still be logged, but info/debug are suppressed
global.console = {
  ...console,
  log: jest.fn(), // Suppress console.log
  debug: jest.fn(), // Suppress debug logs
  info: jest.fn(), // Suppress info logs
  warn: jest.fn(), // Keep warnings visible in tests
  error: jest.fn(), // Keep errors visible in tests
};

// Set longer timeout for integration tests (database operations can be slow)
jest.setTimeout(10000); // 10 seconds
