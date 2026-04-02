/**
 * Test Database Setup
 * Creates a clean test database before each test run
 */

const { Sequelize } = require('sequelize');

const testSequelize = new Sequelize(
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/ginraidee_test',
  {
    logging: false, // Disable SQL query logging in tests
    pool: {
      max: 2, // Limit connections for tests
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

module.exports = async () => {
  try {
    // Test connection
    await testSequelize.authenticate();
    console.log('✅ Test database connected');

    // Drop and recreate all tables (clean slate for tests)
    await testSequelize.sync({ force: true });
    console.log('✅ Test database tables created');
  } catch (error) {
    console.error('❌ Test database setup failed:', error.message);
    throw error;
  }
};
