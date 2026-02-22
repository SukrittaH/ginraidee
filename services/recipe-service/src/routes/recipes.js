const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Recipe Routes
 * All routes require JWT authentication (applied in server.js)
 * Do NOT apply middleware here - it's already applied in server.js
 */

router.post('/generate', recipeController.generateRecipe);
router.post('/suggest', recipeController.suggestByInventory);

module.exports = router;
