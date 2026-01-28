const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  entraIdUserId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Microsoft EntraID Object ID (oid claim from token)',
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
    comment: 'Email address (may be null if user does not share email)',
  },
  entraIdEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email from EntraID token',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'User display name',
  },
  preferredUsername: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Preferred username from EntraID token',
  },
  language: {
    type: DataTypes.ENUM('th', 'en'),
    defaultValue: 'en',
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp of last successful login',
  },
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['entraIdUserId'],
      name: 'idx_user_entraId_unique',
    },
  ],
});

module.exports = User;
