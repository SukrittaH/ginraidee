const logger = require('../config/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  logger.debug('Request received', {
    method: req.method,
    path: req.path,
    query: req.query,
    user_id: req.userId || 'anonymous',
    ip: req.ip,
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);

    if (duration > 3000) {
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
