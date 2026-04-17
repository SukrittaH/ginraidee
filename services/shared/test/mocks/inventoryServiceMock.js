const nock = require('nock');

/**
 * Mock Inventory Service HTTP API responses
 * Uses nock to intercept HTTP requests to inventory-service
 */

// Default inventory service endpoint
const INVENTORY_BASE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';

/**
 * Mock successful getExpiringSoon response
 * @param {Array} items - Array of inventory items
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockGetExpiringSoon(items = []) {
  return nock(INVENTORY_BASE_URL)
    .get(/\/internal\/inventory\/user\/.*\/expiring/)
    .query(true)
    .reply(200, {
      success: true,
      data: items,
    });
}

/**
 * Mock inventory service error
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} errorMessage - Error message
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockInventoryError(statusCode = 500, errorMessage = 'Failed to fetch inventory') {
  return nock(INVENTORY_BASE_URL)
    .get(/\/internal\/inventory\/user\/.*\/expiring/)
    .query(true)
    .reply(statusCode, {
      error: errorMessage,
    });
}

/**
 * Mock inventory service timeout
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockInventoryTimeout() {
  return nock(INVENTORY_BASE_URL)
    .get(/\/internal\/inventory\/user\/.*\/expiring/)
    .query(true)
    .replyWithError({
      code: 'ETIMEDOUT',
      message: 'Request timeout',
    });
}

/**
 * Mock inventory service with specific items expiring soon
 * @param {number} count - Number of items to generate
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockExpiringItems(count = 3) {
  const items = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const expirationDate = new Date(today);
    expirationDate.setDate(expirationDate.getDate() + i);

    items.push({
      id: `item-${i + 1}`,
      name: `Item ${i + 1}`,
      category: 'vegetable',
      quantity: 1,
      unit: 'piece',
      expirationDate: expirationDate.toISOString().split('T')[0],
      emoji: '🥕',
    });
  }

  return mockGetExpiringSoon(items);
}

/**
 * Mock empty expiring items response
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockNoExpiringItems() {
  return mockGetExpiringSoon([]);
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
  mockGetExpiringSoon,
  mockInventoryError,
  mockInventoryTimeout,
  mockExpiringItems,
  mockNoExpiringItems,
  clearMocks,
  verifyMocks,
};
