// Set test environment variables BEFORE requiring any modules
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.ENTRAID_TENANT_ID = 'test-tenant';
process.env.ENTRAID_CLIENT_ID = 'test-client-id';
process.env.ENTRAID_AUTHORITY = 'https://login.microsoftonline.com/common';

const supertest = require('supertest');
const app = require('../../app');
const { User, sequelize } = require('../../models');
const { generateTestToken } = require('../../../../shared/test/helpers/apiHelper');
const {
  mockNewUserTokenExchange,
  mockExistingUserTokenExchange,
  mockTokenExchangeError,
  mockEntraIdServiceDown,
  mockTokenExchangeMalformedResponse,
  mockTokenExchangeInvalidIdToken,
  clearMocks,
} = require('../../../../shared/test/mocks/entraIdMock');

describe('Auth Flow - Integration Tests', () => {
  let testToken;
  let testUser;

  beforeAll(async () => {
    // Ensure database tables are created
    await sequelize.sync({ force: false });
  });

  afterAll(async () => {
    // Close database connection
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await User.destroy({ where: {}, force: true });

    // Create a test user for authenticated endpoints
    testUser = await User.create({
      entraIdUserId: 'test-entra-user-123',
      name: 'Test User',
      email: 'test@example.com',
      entraIdEmail: 'test@example.com',
      preferredUsername: 'test@example.com',
      language: 'en',
    });

    // Generate test JWT token
    testToken = generateTestToken({
      userId: testUser.id,
      entraIdUserId: testUser.entraIdUserId,
    });
  });

  afterEach(() => {
    clearMocks();
  });

  describe('POST /api/auth/token - OAuth Token Exchange', () => {
    it('should create new user on first login', async () => {
      clearMocks();
      mockNewUserTokenExchange();

      const response = await supertest(app)
        .post('/api/auth/token')
        .send({
          code: 'fake-auth-code-123',
          redirectUri: 'http://localhost:3000/callback',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user.name).toBe('New User');

      // Verify user was created in database
      const user = await User.findOne({ where: { entraIdUserId: 'new-user-entra-id' } });
      expect(user).toBeDefined();
      expect(user.email).toBe('newuser@example.com');
      expect(user.language).toBe('en');
    });

    it('should update existing user on subsequent login', async () => {
      // Create existing user
      const existingUser = await User.create({
        entraIdUserId: 'existing-user-entra-id',
        name: 'Old Name',
        email: 'existing@example.com',
        entraIdEmail: 'existing@example.com',
        preferredUsername: 'existing@example.com',
        language: 'th',
      });

      const oldLastLogin = existingUser.lastLoginAt;

      clearMocks();
      mockExistingUserTokenExchange();

      // Wait a bit to ensure lastLoginAt changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await supertest(app)
        .post('/api/auth/token')
        .send({
          code: 'fake-auth-code-456',
          redirectUri: 'http://localhost:3000/callback',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('existing@example.com');

      // Verify lastLoginAt was updated
      const updatedUser = await User.findOne({ where: { entraIdUserId: 'existing-user-entra-id' } });
      expect(updatedUser.lastLoginAt).not.toEqual(oldLastLogin);
      expect(updatedUser.lastLoginAt.getTime()).toBeGreaterThan(existingUser.createdAt.getTime());
    });

    it('should return 400 when code is missing', async () => {
      const response = await supertest(app)
        .post('/api/auth/token')
        .send({
          redirectUri: 'http://localhost:3000/callback',
        })
        .expect(400);

      expect(response.body.error).toBe('Missing code or redirectUri');
    });

    it('should return 400 when redirectUri is missing', async () => {
      const response = await supertest(app)
        .post('/api/auth/token')
        .send({
          code: 'fake-code',
        })
        .expect(400);

      expect(response.body.error).toBe('Missing code or redirectUri');
    });

    it('should return 401 when code is invalid', async () => {
      clearMocks();
      mockTokenExchangeError(400, 'invalid_grant', 'Invalid authorization code');

      const response = await supertest(app)
        .post('/api/auth/token')
        .send({
          code: 'invalid-code',
          redirectUri: 'http://localhost:3000/callback',
        })
        .expect(401);

      expect(response.body.error).toBe('Failed to exchange code for token');
    });

    it('should return 401 when EntraID service is down', async () => {
      clearMocks();
      mockEntraIdServiceDown();

      // Axios network errors are caught and returned as 401 in the controller
      const response = await supertest(app)
        .post('/api/auth/token')
        .send({
          code: 'fake-code',
          redirectUri: 'http://localhost:3000/callback',
        })
        .expect(401);

      expect(response.body.error).toBe('Failed to exchange code for token');
    });

    it('should return 401 when token response is malformed', async () => {
      clearMocks();
      mockTokenExchangeMalformedResponse();

      const response = await supertest(app)
        .post('/api/auth/token')
        .send({
          code: 'fake-code',
          redirectUri: 'http://localhost:3000/callback',
        })
        .expect(401);

      expect(response.body.error).toBe('Failed to exchange code for token');
    });

    it('should return 401 when ID token is invalid (missing oid)', async () => {
      clearMocks();
      mockTokenExchangeInvalidIdToken();

      const response = await supertest(app)
        .post('/api/auth/token')
        .send({
          code: 'fake-code',
          redirectUri: 'http://localhost:3000/callback',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid token received from Microsoft');
    });
  });

  describe('GET /api/auth/profile - Get User Profile', () => {
    it('should return user profile with valid token', async () => {
      const response = await supertest(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user.language).toBe('en');
    });

    it('should return 401 when no token provided', async () => {
      await supertest(app)
        .get('/api/auth/profile')
        .expect(401);
    });

    it('should return 401 when token is invalid', async () => {
      await supertest(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token-123')
        .expect(401);
    });

    it('should return 401 when user not found (auth middleware fails)', async () => {
      // Delete the user
      await User.destroy({ where: { id: testUser.id }, force: true });

      // Auth middleware will fail to find user and return 401
      const response = await supertest(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(401);

      expect(response.body.error).toBe('User not found');
    });
  });

  describe('PUT /api/auth/profile - Update User Preferences', () => {
    it('should update language to Thai', async () => {
      const response = await supertest(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ language: 'th' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.language).toBe('th');

      // Verify database was updated
      const updatedUser = await User.findByPk(testUser.id);
      expect(updatedUser.language).toBe('th');
    });

    it('should update language to English', async () => {
      // Set user to Thai first
      testUser.language = 'th';
      await testUser.save();

      const response = await supertest(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ language: 'en' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.language).toBe('en');
    });

    it('should ignore invalid language values', async () => {
      const response = await supertest(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ language: 'fr' })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Language should remain unchanged
      expect(response.body.user.language).toBe('en');
    });

    it('should handle empty request body', async () => {
      const response = await supertest(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      // Language should remain unchanged
      expect(response.body.user.language).toBe('en');
    });

    it('should return 401 when no token provided', async () => {
      await supertest(app)
        .put('/api/auth/profile')
        .send({ language: 'th' })
        .expect(401);
    });

    it('should return 401 when user not found (auth middleware fails)', async () => {
      // Delete the user
      await User.destroy({ where: { id: testUser.id }, force: true });

      // Auth middleware will fail to find user and return 401
      const response = await supertest(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ language: 'th' })
        .expect(401);

      expect(response.body.error).toBe('User not found');
    });
  });

  describe('DELETE /api/auth/account - Delete User Account', () => {
    it('should delete account with confirmation', async () => {
      const response = await supertest(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ confirm: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');

      // Verify user was deleted
      const deletedUser = await User.findByPk(testUser.id);
      expect(deletedUser).toBeNull();
    });

    it('should return 400 when confirmation is false', async () => {
      const response = await supertest(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ confirm: false })
        .expect(400);

      expect(response.body.error).toBe('Account deletion not confirmed');

      // Verify user was NOT deleted
      const user = await User.findByPk(testUser.id);
      expect(user).not.toBeNull();
    });

    it('should return 400 when confirmation is missing', async () => {
      const response = await supertest(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Account deletion not confirmed');
    });

    it('should return 401 when no token provided', async () => {
      await supertest(app)
        .delete('/api/auth/account')
        .send({ confirm: true })
        .expect(401);
    });

    it('should return 401 when user not found (auth middleware fails)', async () => {
      // Delete the user first
      await User.destroy({ where: { id: testUser.id }, force: true });

      // Auth middleware will fail to find user and return 401
      const response = await supertest(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ confirm: true })
        .expect(401);

      expect(response.body.error).toBe('User not found');
    });
  });
});
