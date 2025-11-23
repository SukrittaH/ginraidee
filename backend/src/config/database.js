require('dotenv').config();
const { Sequelize } = require('sequelize');

// PostgreSQL connection configuration
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING || 'postgresql://localhost:5432/ginraidee';

const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: process.env.NODE_ENV === 'production' ? {
    ssl: {
      require: true,
      rejectUnauthorized: false, // For Azure PostgreSQL
    },
  } : {},
});

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected successfully');

    // Sync models with database (creates tables if they don't exist)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('📊 Database tables synchronized');

      // Create default user for testing (no auth)
      const { User } = require('../models');
      const defaultUserId = '550e8400-e29b-41d4-a716-446655440000';
      const defaultUser = await User.findByPk(defaultUserId);

      if (!defaultUser) {
        await User.create({
          id: defaultUserId,
          email: 'default@test.com',
          password: 'test123',
          name: 'Default User',
          language: 'en',
        });
        console.log('👤 Default user created for testing');
      }
    }
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error.message);

    // For development, continue without database
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Running without database in development mode');
    } else {
      process.exit(1);
    }
  }
};

module.exports = { sequelize, connectDatabase };
