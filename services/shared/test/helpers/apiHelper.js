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

// NOTE: The functions below require 'supertest' to be installed in the consuming service
// They are currently not used, but kept for future reference
// Uncomment when needed and ensure 'supertest' is installed

/*
function createAuthenticatedRequest(app) {
  const supertest = require('supertest');
  const request = supertest(app);
  request.auth = function(token) {
    return this.set('Authorization', `Bearer ${token}`);
  };
  request.withTestUser = function(userPayload = {}) {
    const token = generateTestToken(userPayload);
    return this.set('Authorization', `Bearer ${token}`);
  };
  return request;
}

async function authenticatedGet(app, url, userPayload = {}) {
  const supertest = require('supertest');
  const token = generateTestToken(userPayload);
  return supertest(app)
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

async function authenticatedPost(app, url, body = {}, userPayload = {}) {
  const supertest = require('supertest');
  const token = generateTestToken(userPayload);
  return supertest(app)
    .post(url)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

async function authenticatedPut(app, url, body = {}, userPayload = {}) {
  const supertest = require('supertest');
  const token = generateTestToken(userPayload);
  return supertest(app)
    .put(url)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

async function authenticatedDelete(app, url, userPayload = {}) {
  const supertest = require('supertest');
  const token = generateTestToken(userPayload);
  return supertest(app)
    .delete(url)
    .set('Authorization', `Bearer ${token}`);
}
*/

module.exports = {
  generateTestToken,
  // Commented out - uncomment when needed:
  // createAuthenticatedRequest,
  // authenticatedGet,
  // authenticatedPost,
  // authenticatedPut,
  // authenticatedDelete,
};
