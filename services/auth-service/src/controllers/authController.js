const { User } = require('../models');
const jwt = require('jsonwebtoken');

/**
 * Exchange Microsoft authorization code for tokens
 * Public endpoint - no authentication required
 * Called by mobile app after OAuth redirect from Microsoft
 * Supports both standard Entra ID and Entra External ID tenants
 */
exports.exchangeCodeForToken = async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Missing code or redirectUri' });
    }

    // Determine token endpoint based on tenant configuration
    const tenantId = process.env.ENTRAID_TENANT_ID || 'common';
    const authority = process.env.ENTRAID_AUTHORITY || `https://login.microsoftonline.com/${tenantId}`;

    // Support both standard and External ID endpoints
    let tokenUrl;
    if (authority.includes('ciamlogin.com') || authority.includes('b2clogin.com')) {
      // External ID tenant
      tokenUrl = `${authority}/oauth2/v2.0/token`;
    } else {
      // Standard Microsoft Entra ID
      tokenUrl = `${authority}/oauth2/v2.0/token`;
    }

    const clientId = process.env.ENTRAID_CLIENT_ID;

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      // Note: In production, use a client secret for confidential flows
      // For public clients (mobile apps), code exchange is done on frontend
      // This endpoint is a workaround - ideally use Authorization Code with PKCE
    });

    console.log(`🔐 Exchanging code with token URL: ${tokenUrl}`);

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Microsoft token exchange failed:', tokenData);
      return res.status(401).json({
        error: 'Failed to exchange code for token',
        details: process.env.NODE_ENV === 'development' ? tokenData : undefined
      });
    }

    // Decode ID token to extract user information
    const idToken = tokenData.id_token;
    const decodedToken = jwt.decode(idToken);

    if (!decodedToken || !decodedToken.oid) {
      return res.status(401).json({ error: 'Invalid token received from Microsoft' });
    }

    // Create or update user in database
    const [user] = await User.findOrCreate({
      where: { entraIdUserId: decodedToken.oid },
      defaults: {
        name: decodedToken.name || decodedToken.preferred_username,
        email: decodedToken.email,
        entraIdEmail: decodedToken.email,
        preferredUsername: decodedToken.preferred_username,
        language: 'en',
      },
    });

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Create a backend JWT token for the frontend to use
    const backendToken = jwt.sign(
      {
        userId: user.id,
        entraIdUserId: decodedToken.oid,
        email: decodedToken.email,
      },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '24h' }
    );

    // Return backend JWT token to frontend
    res.json({
      success: true,
      accessToken: backendToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        preferredUsername: user.preferredUsername,
      },
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
};

/**
 * Get current authenticated user's profile
 * Requires: entraIdAuth middleware (req.userId set)
 */
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ['id', 'name', 'email', 'entraIdEmail', 'preferredUsername', 'language', 'lastLoginAt', 'createdAt'],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

/**
 * Update user preferences (language, etc.)
 * Requires: entraIdAuth middleware (req.userId set)
 */
exports.updateUserPreferences = async (req, res) => {
  try {
    const { language } = req.body;

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update allowed fields only
    if (language && ['th', 'en'].includes(language)) {
      user.language = language;
    }

    await user.save();

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        language: user.language,
      },
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};

/**
 * Delete user account (soft delete)
 * Cascades to delete all associated inventory items
 * Requires: entraIdAuth middleware (req.userId set)
 */
exports.deleteAccount = async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({ error: 'Account deletion not confirmed' });
    }

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete associated inventory items (cascade handled by database if configured)
    // Or manually delete if not using cascade constraints
    await user.destroy();

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
