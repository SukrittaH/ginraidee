const express = require('express');
const router = express.Router();
const { InventoryItem } = require('../models');
const { Op } = require('sequelize');

/**
 * Internal API Routes (Service-to-Service Communication)
 * These endpoints are NOT exposed to the frontend via Ingress
 * Only accessible to other services within the cluster
 */

/**
 * Get expiring items for a user
 * Used by Recipe Service to suggest recipes based on expiring ingredients
 *
 * GET /internal/inventory/user/:userId/expiring?days=3
 * No authentication required (internal only)
 */
router.get('/inventory/user/:userId/expiring', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 3;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Calculate target date (now + days)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    // Find all inventory items expiring within the specified days
    const items = await InventoryItem.findAll({
      where: {
        userId,
        expirationDate: {
          [Op.lte]: targetDate,
        },
      },
      order: [['expirationDate', 'ASC']],
    });

    res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    console.error('Get expiring items error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring items' });
  }
});

/**
 * Get all items for a user (internal endpoint)
 *
 * GET /internal/inventory/user/:userId
 * No authentication required (internal only)
 */
router.get('/inventory/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const items = await InventoryItem.findAll({
      where: { userId },
      order: [['expirationDate', 'ASC']],
    });

    res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    console.error('Get user inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch user inventory' });
  }
});

module.exports = router;
