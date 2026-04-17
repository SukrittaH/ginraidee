const nock = require('nock');
const jwt = require('jsonwebtoken');

/**
 * Mock Microsoft EntraID OAuth endpoints
 * Uses nock to intercept HTTP requests to Microsoft identity platform
 */

// Default Microsoft identity endpoint
const ENTRAID_AUTHORITY = process.env.ENTRAID_AUTHORITY || 'https://login.microsoftonline.com/common';

/**
 * Generate a fake JWT ID token
 * @param {Object} userData - User data to encode in token
 * @returns {string} Signed JWT token
 */
function generateFakeIdToken(userData = {}) {
  const defaultData = {
    oid: 'test-entra-user-123',
    name: 'Test User',
    email: 'test@example.com',
    preferred_username: 'test@example.com',
    iss: 'https://login.microsoftonline.com/test-tenant/v2.0',
    aud: 'test-client-id',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...userData,
  };

  // Sign with a test secret (not verified in tests, just needs to be parseable)
  return jwt.sign(defaultData, 'test-secret');
}

/**
 * Mock successful OAuth token exchange
 * @param {Object} userData - User data to include in ID token
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockTokenExchange(userData = {}) {
  const baseUrl = ENTRAID_AUTHORITY.replace(/\/$/, '');
  const idToken = generateFakeIdToken(userData);

  return nock(baseUrl)
    .post(/\/oauth2\/v2\.0\/token/)
    .reply(200, {
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: 'fake-access-token-' + Date.now(),
      id_token: idToken,
      refresh_token: 'fake-refresh-token-' + Date.now(),
    });
}

/**
 * Mock token exchange for new user (first login)
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockNewUserTokenExchange() {
  return mockTokenExchange({
    oid: 'new-user-entra-id',
    name: 'New User',
    email: 'newuser@example.com',
    preferred_username: 'newuser@example.com',
  });
}

/**
 * Mock token exchange for existing user
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockExistingUserTokenExchange() {
  return mockTokenExchange({
    oid: 'existing-user-entra-id',
    name: 'Existing User',
    email: 'existing@example.com',
    preferred_username: 'existing@example.com',
  });
}

/**
 * Mock OAuth token exchange failure (invalid code)
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {string} error - Error code
 * @param {string} errorDescription - Error description
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockTokenExchangeError(statusCode = 400, error = 'invalid_grant', errorDescription = 'Invalid authorization code') {
  const baseUrl = ENTRAID_AUTHORITY.replace(/\/$/, '');

  return nock(baseUrl)
    .post(/\/oauth2\/v2\.0\/token/)
    .reply(statusCode, {
      error,
      error_description: errorDescription,
    });
}

/**
 * Mock EntraID service unavailable
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockEntraIdServiceDown() {
  const baseUrl = ENTRAID_AUTHORITY.replace(/\/$/, '');

  return nock(baseUrl)
    .post(/\/oauth2\/v2\.0\/token/)
    .replyWithError({
      code: 'ECONNREFUSED',
      message: 'Service unavailable',
    });
}

/**
 * Mock token exchange with malformed response (no access_token)
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockTokenExchangeMalformedResponse() {
  const baseUrl = ENTRAID_AUTHORITY.replace(/\/$/, '');

  return nock(baseUrl)
    .post(/\/oauth2\/v2\.0\/token/)
    .reply(200, {
      // Missing access_token field
      token_type: 'Bearer',
      expires_in: 3600,
    });
}

/**
 * Mock token exchange with invalid ID token (no oid)
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockTokenExchangeInvalidIdToken() {
  const baseUrl = ENTRAID_AUTHORITY.replace(/\/$/, '');

  // Create token without oid field
  const invalidIdToken = jwt.sign({
    name: 'Test User',
    email: 'test@example.com',
    // Missing oid field
  }, 'test-secret');

  return nock(baseUrl)
    .post(/\/oauth2\/v2\.0\/token/)
    .reply(200, {
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: 'fake-access-token',
      id_token: invalidIdToken,
    });
}

/**
 * Mock token exchange for External ID tenant (ciamlogin.com)
 * @returns {nock.Scope} Nock scope for assertions
 */
function mockExternalIdTokenExchange() {
  const externalIdAuthority = 'https://test-tenant.ciamlogin.com';
  const idToken = generateFakeIdToken();

  return nock(externalIdAuthority)
    .post(/\/oauth2\/v2\.0\/token/)
    .reply(200, {
      token_type: 'Bearer',
      expires_in: 3600,
      access_token: 'fake-access-token',
      id_token: idToken,
    });
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
  generateFakeIdToken,
  mockTokenExchange,
  mockNewUserTokenExchange,
  mockExistingUserTokenExchange,
  mockTokenExchangeError,
  mockEntraIdServiceDown,
  mockTokenExchangeMalformedResponse,
  mockTokenExchangeInvalidIdToken,
  mockExternalIdTokenExchange,
  clearMocks,
  verifyMocks,
};
