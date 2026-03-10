const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/suggest-menu', recipeController.suggestMenu);
router.post('/resuggest-menu', recipeController.resuggestMenu);
router.post('/generate', recipeController.generateRecipe);
router.post('/suggest', recipeController.suggestByInventory);

module.exports = router;
