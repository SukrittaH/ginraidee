const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Middleware
 * Validates backend JWT tokens locally (no database call per request)
 *
 * Expects: Authorization header with "Bearer <token>"
 * Sets: req.userId, req.user
 * Returns: 401 Unauthorized if token is invalid
 *
 * Note: OCR Service uses this for protected endpoints.
 * Some endpoints (like /health) don't require authentication.
 */
async function authMiddleware(req, res, next) {
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

    // Set user info on request object for downstream controllers
    req.userId = decoded.userId;
    req.user = {
      id: decoded.userId,
      entraIdUserId: decoded.entraIdUserId,
      email: decoded.email,
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
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = authMiddleware;
