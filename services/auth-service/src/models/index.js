const { sequelize } = require('../config/database');
const User = require('./User');

// Export models and sequelize instance
// Note: Auth Service only exports User model (InventoryItem is managed by Inventory Service)
module.exports = {
  sequelize,
  User,
};
