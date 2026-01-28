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
      // Drop existing tables in dev to ensure clean schema with new EntraID fields
      await sequelize.sync({ force: true });
      console.log('📊 Database tables synchronized (reset for EntraID migration)');

      // Note: Test users should now authenticate through Microsoft EntraID
      // The backend will automatically create users on first login
      console.log('👤 Users will be created automatically on EntraID login');
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
