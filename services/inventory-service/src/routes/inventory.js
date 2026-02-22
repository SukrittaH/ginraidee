const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

/**
 * Inventory Routes
 * All routes require JWT authentication (applied in server.js)
 * Do NOT apply middleware here - it's already applied in server.js
 */

// Special queries (must come before /:id routes)
router.get('/expiring/soon', inventoryController.getExpiringSoon);
router.get('/by-date/:date', inventoryController.getByDate);

// Inventory CRUD operations
router.get('/', inventoryController.getAll);
router.get('/:id', inventoryController.getById);
router.post('/', inventoryController.create);
router.put('/:id', inventoryController.update);
router.delete('/:id', inventoryController.delete);

module.exports = router;
