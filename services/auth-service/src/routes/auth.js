const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const entraIdAuth = require('../middleware/entraIdAuth');

/**
 * Auth Routes
 * All routes require EntraID token validation (except public endpoints)
 */

// Exchange authorization code for tokens
// Public endpoint - used by mobile app after OAuth redirect
// POST /auth/token
// Body: { code: string, redirectUri: string }
router.post('/token', authController.exchangeCodeForToken);

// Get authenticated user's profile
// Requires: Valid EntraID token in Authorization header
router.get('/profile', entraIdAuth, authController.getUserProfile);

// Update user preferences (language, etc.)
// Requires: Valid EntraID token in Authorization header
router.put('/profile', entraIdAuth, authController.updateUserPreferences);

// Delete user account
// Requires: Valid EntraID token in Authorization header
router.delete('/account', entraIdAuth, authController.deleteAccount);

module.exports = router;
