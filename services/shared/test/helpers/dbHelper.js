/**
 * Database helper utilities for testing
 */

/**
 * Clean up database tables
 * @param {Object} sequelize - Sequelize instance
 * @param {Array<string>} tables - Table names to truncate (optional, truncates all if not specified)
 */
async function cleanupDatabase(sequelize, tables = []) {
  if (tables.length > 0) {
    // Truncate specific tables
    for (const table of tables) {
      await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE`);
    }
  } else {
    // Truncate all tables
    await sequelize.sync({ force: true });
  }
}

/**
 * Seed database with test data
 * @param {Object} models - Sequelize models object
 * @param {Object} data - Data to seed { User: [...], InventoryItem: [...] }
 */
async function seedDatabase(models, data) {
  for (const [modelName, records] of Object.entries(data)) {
    if (models[modelName]) {
      await models[modelName].bulkCreate(records);
    }
  }
}

/**
 * Create a test transaction
 * @param {Object} sequelize - Sequelize instance
 * @returns {Promise<Object>} Transaction object
 */
async function createTestTransaction(sequelize) {
  return await sequelize.transaction();
}

/**
 * Rollback a test transaction
 * @param {Object} transaction - Transaction object
 */
async function rollbackTestTransaction(transaction) {
  if (transaction && !transaction.finished) {
    await transaction.rollback();
  }
}

/**
 * Count records in a table
 * @param {Object} model - Sequelize model
 * @param {Object} where - Where clause (optional)
 * @returns {Promise<number>} Record count
 */
async function countRecords(model, where = {}) {
  return await model.count({ where });
}

/**
 * Clear all data from a specific model
 * @param {Object} model - Sequelize model
 */
async function clearModel(model) {
  await model.destroy({ where: {}, truncate: true });
}

module.exports = {
  cleanupDatabase,
  seedDatabase,
  createTestTransaction,
  rollbackTestTransaction,
  countRecords,
  clearModel,
};
