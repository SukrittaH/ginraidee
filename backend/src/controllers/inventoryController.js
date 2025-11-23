const { InventoryItem, User } = require('../models');
const { Op } = require('sequelize');

// Default user ID for testing (no auth) - using a proper UUID
const DEFAULT_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

// Get all inventory items
exports.getAll = async (req, res) => {
  try {
    const items = await InventoryItem.findAll({
      where: { userId: DEFAULT_USER_ID },
      order: [['expirationDate', 'ASC']],
    });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

// Get single item by ID
exports.getById = async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      where: {
        id: req.params.id,
        userId: DEFAULT_USER_ID,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
};

// Create new inventory item
exports.create = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      userId: DEFAULT_USER_ID,
    };

    const item = await InventoryItem.create(itemData);

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
};

// Update inventory item
exports.update = async (req, res) => {
  try {
    const [updated] = await InventoryItem.update(req.body, {
      where: {
        id: req.params.id,
        userId: DEFAULT_USER_ID,
      },
    });

    if (!updated) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = await InventoryItem.findByPk(req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
};

// Delete inventory item
exports.delete = async (req, res) => {
  try {
    const deleted = await InventoryItem.destroy({
      where: {
        id: req.params.id,
        userId: DEFAULT_USER_ID,
      },
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
};

// Get items expiring soon (within 3 days)
exports.getExpiringSoon = async (req, res) => {
  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const items = await InventoryItem.findAll({
      where: {
        userId: DEFAULT_USER_ID,
        expirationDate: {
          [Op.lte]: threeDaysFromNow,
        },
      },
      order: [['expirationDate', 'ASC']],
    });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get expiring items error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring items' });
  }
};

// Get items by specific date
exports.getByDate = async (req, res) => {
  try {
    const targetDate = req.params.date;

    const items = await InventoryItem.findAll({
      where: {
        userId: DEFAULT_USER_ID,
        expirationDate: targetDate,
      },
    });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get items by date error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};
