const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const entraIdAuth = require('../middleware/entraIdAuth');

/**
 * Recipe Routes
 * All routes require EntraID authentication
 */

// Apply authentication middleware to all routes
router.use(entraIdAuth);

router.post('/generate', recipeController.generateRecipe);
router.post('/suggest', recipeController.suggestByInventory);

module.exports = router;
