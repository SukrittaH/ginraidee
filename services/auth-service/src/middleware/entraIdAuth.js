const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * EntraID Authentication Middleware
 * Validates backend JWT tokens (created during OAuth token exchange)
 *
 * Expects: Authorization header with "Bearer <token>"
 * Sets: req.userId, req.user
 * Returns: 401 Unauthorized if token is invalid
 */
async function entraIdAuth(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify and decode the backend JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key', {
      algorithms: ['HS256'],
    });

    // Get user from database
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Set user info on request object for downstream controllers
    req.userId = user.id;
    req.user = {
      id: user.id,
      entraIdUserId: user.entraIdUserId,
      email: user.email,
      name: user.name,
      language: user.language,
    };

    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    // Log unexpected errors for debugging
    console.error('EntraID auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = entraIdAuth;
