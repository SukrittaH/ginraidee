/**
 * Generate fake User data for testing
 * @param {Object} overrides - Optional fields to override
 * @returns {Object} User data
 */
function createUser(overrides = {}) {
  // Require faker lazily so it's resolved from the calling service's node_modules
  const { faker } = require('@faker-js/faker');

  return {
    id: faker.string.uuid(),
    entraIdUserId: faker.string.uuid(),
    email: faker.internet.email(),
    entraIdEmail: faker.internet.email(),
    name: faker.person.fullName(),
    preferredUsername: faker.internet.userName(),
    language: faker.helpers.arrayElement(['th', 'en']),
    lastLoginAt: faker.date.recent(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

/**
 * Generate multiple fake users
 * @param {number} count - Number of users to generate
 * @param {Object} overrides - Optional fields to override for all users
 * @returns {Array<Object>} Array of user data
 */
function createUsers(count, overrides = {}) {
  return Array.from({ length: count }, () => createUser(overrides));
}

module.exports = {
  createUser,
  createUsers,
};
