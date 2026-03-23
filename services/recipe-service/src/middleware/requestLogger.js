const logger = require('../config/logger');

/**
 * Express middleware to log HTTP requests
 * Replaces morgan with structured logging
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request received
  logger.debug('Request received', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);

    // Warn on slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration_ms: duration,
        status_code: res.statusCode,
      });
    }
  });

  next();
};

module.exports = requestLogger;
