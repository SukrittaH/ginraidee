const { sequelize } = require('../config/database');
const User = require('./User');
const InventoryItem = require('./Inventory');

// Export models and sequelize instance
module.exports = {
  sequelize,
  User,
  InventoryItem,
};
