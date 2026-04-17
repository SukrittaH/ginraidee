const supertest = require('supertest');
const jwt = require('jsonwebtoken');

/**
 * Generate a test JWT token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
function generateTestToken(payload = {}) {
  const defaultPayload = {
    userId: payload.userId || 'test-user-id',
    email: payload.email || 'test@example.com',
    name: payload.name || 'Test User',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };

  return jwt.sign(
    { ...defaultPayload, ...payload },
    process.env.JWT_SECRET || 'test-secret'
  );
}

/**
 * Create authenticated supertest request
 * @param {Object} app - Express app
 * @returns {Object} Supertest request with auth helper
 */
function createAuthenticatedRequest(app) {
  const request = supertest(app);

  // Add auth helper method
  request.auth = function(token) {
    return this.set('Authorization', `Bearer ${token}`);
  };

  // Add helper to create request with test user token
  request.withTestUser = function(userPayload = {}) {
    const token = generateTestToken(userPayload);
    return this.set('Authorization', `Bearer ${token}`);
  };

  return request;
}

/**
 * Make an authenticated GET request
 * @param {Object} app - Express app
 * @param {string} url - Request URL
 * @param {Object} userPayload - User payload for token
 * @returns {Promise} Supertest promise
 */
async function authenticatedGet(app, url, userPayload = {}) {
  const token = generateTestToken(userPayload);
  return supertest(app)
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

/**
 * Make an authenticated POST request
 * @param {Object} app - Express app
 * @param {string} url - Request URL
 * @param {Object} body - Request body
 * @param {Object} userPayload - User payload for token
 * @returns {Promise} Supertest promise
 */
async function authenticatedPost(app, url, body = {}, userPayload = {}) {
  const token = generateTestToken(userPayload);
  return supertest(app)
    .post(url)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/**
 * Make an authenticated PUT request
 * @param {Object} app - Express app
 * @param {string} url - Request URL
 * @param {Object} body - Request body
 * @param {Object} userPayload - User payload for token
 * @returns {Promise} Supertest promise
 */
async function authenticatedPut(app, url, body = {}, userPayload = {}) {
  const token = generateTestToken(userPayload);
  return supertest(app)
    .put(url)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/**
 * Make an authenticated DELETE request
 * @param {Object} app - Express app
 * @param {string} url - Request URL
 * @param {Object} userPayload - User payload for token
 * @returns {Promise} Supertest promise
 */
async function authenticatedDelete(app, url, userPayload = {}) {
  const token = generateTestToken(userPayload);
  return supertest(app)
    .delete(url)
    .set('Authorization', `Bearer ${token}`);
}

module.exports = {
  generateTestToken,
  createAuthenticatedRequest,
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
};
