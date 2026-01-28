const { InventoryItem, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Inventory Controller
 * All functions require authentication (req.userId set by entraIdAuth middleware)
 */

// Get all inventory items for authenticated user
exports.getAll = async (req, res) => {
  try {
    const items = await InventoryItem.findAll({
      where: { userId: req.userId },
      order: [['expirationDate', 'ASC']],
    });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

// Get single item by ID for authenticated user
exports.getById = async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      where: {
        id: req.params.id,
        userId: req.userId,
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

// Create new inventory item for authenticated user
exports.create = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      userId: req.userId,
    };

    const item = await InventoryItem.create(itemData);

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
};

// Update inventory item for authenticated user
exports.update = async (req, res) => {
  try {
    const [updated] = await InventoryItem.update(req.body, {
      where: {
        id: req.params.id,
        userId: req.userId,
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

// Delete inventory item for authenticated user
exports.delete = async (req, res) => {
  try {
    const deleted = await InventoryItem.destroy({
      where: {
        id: req.params.id,
        userId: req.userId,
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

// Get items expiring soon (within 3 days) for authenticated user
exports.getExpiringSoon = async (req, res) => {
  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const items = await InventoryItem.findAll({
      where: {
        userId: req.userId,
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

// Get items by specific date for authenticated user
exports.getByDate = async (req, res) => {
  try {
    const targetDate = req.params.date;

    const items = await InventoryItem.findAll({
      where: {
        userId: req.userId,
        expirationDate: targetDate,
      },
    });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get items by date error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};
