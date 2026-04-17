const { InventoryItem, User } = require('../models');
const { Op } = require('sequelize');
const { trace } = require('@opentelemetry/api');
const logger = require('../config/logger');

/**
 * Inventory Controller
 * All functions require authentication (req.userId set by entraIdAuth middleware)
 */

// Get all inventory items for authenticated user
exports.getAll = async (req, res) => {
  const tracer = trace.getTracer('inventory-controller');
  const span = tracer.startSpan('getAll', {
    attributes: {
      'inventory.user_id': req.userId,
    },
  });

  try {
    logger.debug('Fetching all inventory items', { user_id: req.userId });

    const items = await InventoryItem.findAll({
      where: { userId: req.userId },
      order: [['expirationDate', 'ASC']],
    });

    span.setAttribute('inventory.items_count', items.length);
    span.setStatus({ code: 1 }); // OK

    logger.info('Inventory items fetched successfully', {
      user_id: req.userId,
      items_count: items.length,
    });

    res.json({ success: true, data: items });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });

    logger.error('Failed to fetch inventory', {
      user_id: req.userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: 'Failed to fetch inventory' });
  } finally {
    span.end();
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
  const tracer = trace.getTracer('inventory-controller');
  const span = tracer.startSpan('create', {
    attributes: {
      'inventory.user_id': req.userId,
      'inventory.item_name': req.body.name,
      'inventory.category': req.body.category,
    },
  });

  try {
    const itemData = {
      ...req.body,
      userId: req.userId,
    };

    logger.debug('Creating inventory item', {
      user_id: req.userId,
      item_name: req.body.name,
      category: req.body.category,
    });

    const item = await InventoryItem.create(itemData);

    span.setAttribute('inventory.item_id', item.id);
    span.setStatus({ code: 1 }); // OK

    logger.logBusinessEvent('inventory_item_created', {
      user_id: req.userId,
      item_id: item.id,
      item_name: item.name,
      category: item.category,
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });

    logger.error('Failed to create inventory item', {
      user_id: req.userId,
      item_name: req.body.name,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: 'Failed to create item' });
  } finally {
    span.end();
  }
};

// Update inventory item for authenticated user
exports.update = async (req, res) => {
  const tracer = trace.getTracer('inventory-controller');
  const span = tracer.startSpan('update', {
    attributes: {
      'inventory.user_id': req.userId,
      'inventory.item_id': req.params.id,
    },
  });

  try {
    const [updated] = await InventoryItem.update(req.body, {
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!updated) {
      span.setStatus({ code: 2, message: 'Item not found' });
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = await InventoryItem.findByPk(req.params.id);
    span.setStatus({ code: 1 }); // OK
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update item error:', error);
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    res.status(500).json({ error: 'Failed to update item' });
  } finally {
    span.end();
  }
};

// Delete inventory item for authenticated user
exports.delete = async (req, res) => {
  const tracer = trace.getTracer('inventory-controller');
  const span = tracer.startSpan('delete', {
    attributes: {
      'inventory.user_id': req.userId,
      'inventory.item_id': req.params.id,
    },
  });

  try {
    const deleted = await InventoryItem.destroy({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!deleted) {
      span.setStatus({ code: 2, message: 'Item not found' });
      return res.status(404).json({ error: 'Item not found' });
    }

    span.setStatus({ code: 1 }); // OK
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Delete item error:', error);
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    res.status(500).json({ error: 'Failed to delete item' });
  } finally {
    span.end();
  }
};

// Get items expiring soon (within 3 days) for authenticated user
exports.getExpiringSoon = async (req, res) => {
  const tracer = trace.getTracer('inventory-controller');
  const span = tracer.startSpan('getExpiringSoon', {
    attributes: {
      'inventory.user_id': req.userId,
      'inventory.expiry_window_days': 3,
    },
  });

  try {
    const today = new Date();
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    // Format dates as YYYY-MM-DD strings for DATEONLY comparison
    const todayStr = today.toISOString().split('T')[0];
    const twoDaysStr = twoDaysFromNow.toISOString().split('T')[0];

    const items = await InventoryItem.findAll({
      where: {
        userId: req.userId,
        expirationDate: {
          [Op.gte]: todayStr,
          [Op.lte]: twoDaysStr,
        },
      },
      order: [['expirationDate', 'ASC']],
    });

    span.setAttribute('inventory.expiring_items_count', items.length);
    span.setStatus({ code: 1 }); // OK
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get expiring items error:', error);
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    res.status(500).json({ error: 'Failed to fetch expiring items' });
  } finally {
    span.end();
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
