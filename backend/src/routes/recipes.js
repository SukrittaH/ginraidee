const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');

// Recipe routes (no auth required for now)
router.post('/generate', recipeController.generateRecipe);
router.post('/suggest', recipeController.suggestByInventory);

module.exports = router;
