const { sequelize } = require('../config/database');
const User = require('./User');
const InventoryItem = require('./Inventory');

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  InventoryItem,
};
