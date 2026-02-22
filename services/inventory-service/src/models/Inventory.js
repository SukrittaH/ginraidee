const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const InventoryItem = sequelize.define('InventoryItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expirationDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  emoji: {
    type: DataTypes.STRING(10),
  },
  backgroundColor: {
    type: DataTypes.STRING(20),
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'expirationDate'],
    },
    {
      fields: ['expirationDate'],
    },
  ],
});

// Define associations
User.hasMany(InventoryItem, { foreignKey: 'userId', onDelete: 'CASCADE' });
InventoryItem.belongsTo(User, { foreignKey: 'userId' });

module.exports = InventoryItem;
